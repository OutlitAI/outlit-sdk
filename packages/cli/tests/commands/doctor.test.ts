import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ExitError, mockExitThrow, setNonInteractive, TEST_API_KEY, useTempEnv } from "../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  integrations: [],
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
    "/api/validate-api-key",
    process.env.OUTLIT_API_URL ?? "https://app.outlit.ai",
  ).toString()
}

describe("doctor command", () => {
  const testDir = useTempEnv("doctor-test")
  const originalPath = process.env.PATH

  afterEach(() => {
    if (originalPath === undefined) Reflect.deleteProperty(process.env, "PATH")
    else process.env.PATH = originalPath
  })

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
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            createdById: null,
            authorization: { grants: ["integrations:manage"] },
          }),
          { status: 200 },
        )
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
    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_integration_status", {})
  })

  test("reports detected coding agents as missing until the outlit skill is installed", async () => {
    const { buildAgentChecks } = await import("../../src/commands/doctor")
    const checks = buildAgentChecks(
      ["claude-code", "codex", "gemini", "droid", "opencode", "pi", "openclaw"],
      {
        homeDir: testDir,
        claudeConfigDir: join(testDir, ".claude"),
      },
    )

    const claudeCheck = checks.find((check) => check.name === "Claude Code")
    const codexCheck = checks.find((check) => check.name === "Codex")
    const geminiCheck = checks.find((check) => check.name === "Gemini CLI")
    const droidCheck = checks.find((check) => check.name === "Droid")
    const opencodeCheck = checks.find((check) => check.name === "OpenCode")
    const piCheck = checks.find((check) => check.name === "Pi")
    const openclawCheck = checks.find((check) => check.name === "OpenClaw")
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
    expect(openclawCheck?.status).toBe("warn")
    expect(openclawCheck?.detail).toBe("Run `outlit setup openclaw` to install the Outlit skill")
  })

  test("detects installed skills across shared and agent-specific skill directories", async () => {
    const installedSkillDirs = [
      join(testDir, ".agents", "skills", "outlit"),
      join(testDir, ".claude", "skills", "outlit"),
      join(testDir, ".factory", "skills", "outlit"),
      join(testDir, ".pi", "agent", "skills", "outlit"),
      join(testDir, ".openclaw", "skills", "outlit"),
    ]

    for (const dir of installedSkillDirs) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, "SKILL.md"), "---\nname: outlit\ndescription: test\n---\n")
    }

    const { buildAgentChecks } = await import("../../src/commands/doctor")
    const checks = buildAgentChecks(
      ["claude-code", "codex", "gemini", "droid", "opencode", "pi", "openclaw"],
      {
        homeDir: testDir,
        claudeConfigDir: join(testDir, ".claude"),
      },
    )

    for (const name of [
      "Claude Code",
      "Codex",
      "Gemini CLI",
      "Droid",
      "OpenCode",
      "Pi",
      "OpenClaw",
    ]) {
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
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            createdById: null,
            authorization: { grants: [] },
          }),
          { status: 200 },
        )
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

  test("uses standalone update guidance in the CLI version warning", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const originalArgv1 = process.argv[1]
    process.argv[1] = "/$bunfs/root/outlit-linux-x64"

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            createdById: null,
            authorization: { grants: ["integrations:manage"] },
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
      if (originalArgv1 === undefined) Reflect.deleteProperty(process.argv, "1")
      else process.argv[1] = originalArgv1
    }

    const parsed = JSON.parse(written) as { checks: Array<Record<string, string>> }
    const versionCheck = parsed.checks.find((check) => check.name === "CLI version")
    expect(versionCheck?.status).toBe("warn")
    expect(versionCheck?.detail).toContain("install.sh")
    expect(versionCheck?.detail).not.toContain("package manager")
  })

  test("warns cleanly when it cannot check for CLI updates", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        throw new Error("network down")
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            createdById: null,
            authorization: { grants: [] },
          }),
          { status: 200 },
        )
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

  test("shows org, key grants, and unavailable families for a scoped key", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            organization: { id: "org_123", name: "Acme", slug: "acme" },
            createdById: "user_1",
            apiKey: {
              id: "key_1",
              name: "dogfood",
              prefix: "ok_aaaa",
              keyType: "cli",
              grants: ["customer_intelligence:read"],
              createdAt: "2026-01-01T00:00:00Z",
              lastUsedAt: null,
              totalRequests: 0,
            },
            authorization: { grants: ["customer_intelligence:read"] },
          }),
          { status: 200 },
        )
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

    const validation = parsed.checks.find((check) => check.name === "API validation")
    expect(validation?.status).toBe("pass")
    expect(validation?.detail).toContain("Acme")

    const permissions = parsed.checks.find((check) => check.name === "Permissions")
    expect(permissions?.status).toBe("warn")
    expect(permissions?.message).toBe("1 key grant")
    expect(permissions?.detail).toContain("customer_intelligence:read")
    expect(permissions?.detail).toContain("unavailable")
    expect(permissions?.detail).toContain("integrations")
    expect(permissions?.detail).toContain("destinations")
    expect(permissions?.detail).toContain("features")

    // A read-only key still gets the identity/merge read surfaces; only the
    // write operations are unavailable.
    expect(permissions?.detail).not.toContain("identity suggestions list")
    expect(permissions?.detail).not.toContain("merge-status")
    expect(permissions?.detail).not.toContain("merge (preview)")
    expect(permissions?.detail).toContain("identity suggestions reject")
    expect(permissions?.detail).toContain("customers merge --execute")

    // Restricted key: integrations check explains the missing grant without a
    // guaranteed-denied API call.
    const integrations = parsed.checks.find((check) => check.name === "Integrations")
    expect(integrations?.status).toBe("warn")
    expect(integrations?.message).toContain("does not grant")
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("does not treat manage grants as implying read access", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            createdById: "user_1",
            authorization: {
              grants: [
                "workspace_settings:manage",
                "activation:manage",
                "customer_access:manage",
                "customer_identity:review",
                "customer_identity:merge",
              ],
            },
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
    }

    const parsed = JSON.parse(written) as { checks: Array<Record<string, string>> }
    const permissions = parsed.checks.find((check) => check.name === "Permissions")
    expect(permissions?.status).toBe("warn")

    // Write operations are available to this key — they must not be listed.
    expect(permissions?.detail).not.toContain("settings update")
    expect(permissions?.detail).not.toContain("activation update")
    expect(permissions?.detail).not.toContain("identity suggestions reject")
    expect(permissions?.detail).not.toContain("customers merge --execute")
    expect(permissions?.detail).not.toContain("customers grant")

    // The matching read operations require read grants this key lacks.
    expect(permissions?.detail).toContain("settings get")
    expect(permissions?.detail).toContain("activation get, preview")
    expect(permissions?.detail).toContain("identity suggestions list")
    expect(permissions?.detail).toContain("customers merge (preview)")
    expect(permissions?.detail).toContain("merge-status")
  })

  test("runs the integrations check when the key grants integrations access", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            createdById: "user_1",
            authorization: { grants: ["customer_intelligence:read", "integrations:manage"] },
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
    }

    const parsed = JSON.parse(written) as { checks: Array<Record<string, string>> }
    const integrations = parsed.checks.find((check) => check.name === "Integrations")
    expect(integrations?.status).toBe("pass")
    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_integration_status", {})
  })

  test("treats connect_own keys without a creator as unable to read integrations", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            createdById: null,
            authorization: { grants: ["integrations:connect_own"] },
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
    }

    const parsed = JSON.parse(written) as { checks: Array<Record<string, string>> }
    const integrations = parsed.checks.find((check) => check.name === "Integrations")
    expect(integrations?.status).toBe("warn")
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("explains denied integrations access when the gateway returns forbidden", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const { OutlitToolsApiError } = await import("@outlit/tools")
    mockCallTool.mockRejectedValueOnce(
      new OutlitToolsApiError(403, "forbidden", {
        code: "TOOL_CALL_FORBIDDEN",
        message: "Integration command is not authorized.",
        retryable: false,
        requestId: "req_1",
      }),
    )

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            createdById: "user_1",
            authorization: { grants: ["integrations:manage"] },
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
    }

    const parsed = JSON.parse(written) as { checks: Array<Record<string, string>> }
    const integrations = parsed.checks.find((check) => check.name === "Integrations")
    expect(integrations?.status).toBe("warn")
    expect(integrations?.message).toContain("denied")
  })

  test("keeps permissions unknown when validation is unavailable", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        return new Response(JSON.stringify({ error: "temporarily unavailable" }), {
          status: 503,
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
    }

    const parsed = JSON.parse(written) as { checks: Array<Record<string, string>> }
    const validation = parsed.checks.find((check) => check.name === "API validation")
    expect(validation?.status).toBe("warn")
    // Unavailable validation means grants are unknown — no permission claims.
    expect(parsed.checks.find((check) => check.name === "Permissions")).toBeUndefined()
    // The integrations check still runs against the live API.
    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_integration_status", {})
  })

  test("reports all families available for a full-access key", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 })
      }
      if (url === getValidateApiKeyUrl()) {
        const { apiKeyGrants } = await import("@outlit/tools")
        return new Response(
          JSON.stringify({
            valid: true,
            organizationId: "org_123",
            createdById: "user_1",
            authorization: { grants: [...apiKeyGrants] },
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
    }

    const parsed = JSON.parse(written) as { checks: Array<Record<string, string>> }
    const permissions = parsed.checks.find((check) => check.name === "Permissions")
    expect(permissions?.status).toBe("pass")
    expect(permissions?.detail ?? "").not.toContain("unavailable")
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
