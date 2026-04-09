import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ExitError, mockExitThrow, setNonInteractive, TEST_API_KEY, useTempEnv } from "../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [],
  pagination: { hasMore: false },
}))

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

function getValidateApiKeyUrl(): string {
  return new URL(
    "/api/internal/mcp/validate-api-key",
    process.env.OUTLIT_API_URL ?? "https://app.outlit.ai",
  ).toString()
}

describe("doctor command", () => {
  const testDir = useTempEnv("doctor-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
    process.env.PATH = "/usr/bin:/bin"
  })

  test("outputs JSON with ok: false when no API key found", async () => {
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 }),
    )

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let thrown: unknown
    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      exitSpy.mockRestore()
      fetchSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(parsed.ok).toBe(false)
  })

  test("outputs JSON with ok: true when API key is valid", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), {
          status: 200,
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    let thrown: unknown
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expect(thrown).toBeUndefined()
    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(parsed.ok).toBe(true)
    const checks = parsed.checks as Array<Record<string, unknown>>
    expect(Array.isArray(checks)).toBe(true)
    expect(checks.every((c) => c.name && c.status && c.message)).toBe(true)
  })

  test("reports detected coding agents as missing until the outlit skill is installed", async () => {
    const { buildAgentChecks } = await import("../../src/commands/doctor")
    const checks = buildAgentChecks(["claude-code", "codex", "gemini", "droid", "opencode", "pi"], {
      homeDir: testDir,
      claudeConfigDir: join(testDir, ".claude"),
    })

    const claudeCheck = checks.find((check) => check.name === "Claude Code")
    const codexCheck = checks.find((check) => check.name === "Codex")
    const geminiCheck = checks.find((check) => check.name === "Gemini CLI")
    const droidCheck = checks.find((check) => check.name === "Droid")
    const opencodeCheck = checks.find((check) => check.name === "OpenCode")
    const piCheck = checks.find((check) => check.name === "Pi")
    expect(claudeCheck?.status).toBe("warn")
    expect(claudeCheck?.detail).toBe("Run `outlit setup claude-code` to install the Outlit skill")
    expect(codexCheck?.status).toBe("warn")
    expect(codexCheck?.detail).toBe("Run `outlit setup codex` to install the Outlit skill")
    expect(geminiCheck?.status).toBe("warn")
    expect(geminiCheck?.detail).toBe("Run `outlit setup gemini` to install the Outlit skill")
    expect(droidCheck?.status).toBe("warn")
    expect(droidCheck?.detail).toBe("Run `outlit setup droid` to install the Outlit skill")
    expect(opencodeCheck?.status).toBe("warn")
    expect(opencodeCheck?.detail).toBe("Run `outlit setup opencode` to install the Outlit skill")
    expect(piCheck?.status).toBe("warn")
    expect(piCheck?.detail).toBe("Run `outlit setup pi` to install the Outlit skill")
  })

  test("detects installed skills across shared and agent-specific skill directories", async () => {
    const installedSkillDirs = [
      join(testDir, ".agents", "skills", "outlit"),
      join(testDir, ".claude", "skills", "outlit"),
      join(testDir, ".factory", "skills", "outlit"),
      join(testDir, ".pi", "agent", "skills", "outlit"),
    ]

    for (const dir of installedSkillDirs) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, "SKILL.md"), "---\nname: outlit\ndescription: test\n---\n")
    }

    const { buildAgentChecks } = await import("../../src/commands/doctor")
    const checks = buildAgentChecks(["claude-code", "codex", "gemini", "droid", "opencode", "pi"], {
      homeDir: testDir,
      claudeConfigDir: join(testDir, ".claude"),
    })

    for (const name of ["Claude Code", "Codex", "Gemini CLI", "Droid", "OpenCode", "Pi"]) {
      const check = checks.find((entry) => entry.name === name)
      expect(check?.status).toBe("pass")
      expect(check?.message).toBe("Outlit skill installed")
    }
  })

  test("uses the shared installer-aware update command in the CLI version warning", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), {
          status: 200,
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    let thrown: unknown
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
      Reflect.deleteProperty(process.env, "npm_config_user_agent")
    }

    expect(thrown).toBeUndefined()
    const parsed = JSON.parse(written) as { checks: Array<Record<string, string>> }
    const versionCheck = parsed.checks.find((check) => check.name === "CLI version")
    expect(versionCheck?.status).toBe("warn")
    expect(versionCheck?.detail).toBe("Run `bun add -g @outlit/cli` to update")
  })

  test("warns cleanly when it cannot check for CLI updates", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        throw new Error("network down")
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), {
          status: 200,
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    let thrown: unknown
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expect(thrown).toBeUndefined()
    const parsed = JSON.parse(written) as { checks: Array<Record<string, string>> }
    const versionCheck = parsed.checks.find((check) => check.name === "CLI version")
    expect(versionCheck?.status).toBe("warn")
    expect(versionCheck?.message).toBe(
      `v${(await import("../../src/lib/config")).CLI_VERSION} (could not check for updates)`,
    )
  })

  test("outputs JSON with ok: false when API key has invalid format", async () => {
    process.env.OUTLIT_API_KEY = "invalid_key_no_prefix"

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 }),
    )

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let thrown: unknown
    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      exitSpy.mockRestore()
      fetchSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(parsed.ok).toBe(false)
  })
})
