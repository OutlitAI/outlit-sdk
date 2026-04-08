import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
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

describe("doctor command", () => {
  useTempEnv("doctor-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
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
      if (url === "https://app.outlit.ai/api/internal/mcp/validate-api-key") {
        return new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), {
          status: 200,
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
    }

    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(parsed.ok).toBe(true)
    const checks = parsed.checks as Array<Record<string, unknown>>
    expect(Array.isArray(checks)).toBe(true)
    expect(checks.every((c) => c.name && c.status && c.message)).toBe(true)
  })

  test("uses the shared installer-aware update command in the CLI version warning", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    process.env.npm_config_user_agent = "bun/1.3.9 npm/? node/v22.0.0 darwin x64"

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input) => {
      const url = String(input)
      if (url === "https://registry.npmjs.org/@outlit%2Fcli/latest") {
        return new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 })
      }
      if (url === "https://app.outlit.ai/api/internal/mcp/validate-api-key") {
        return new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), {
          status: 200,
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
      Reflect.deleteProperty(process.env, "npm_config_user_agent")
    }

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
      if (url === "https://app.outlit.ai/api/internal/mcp/validate-api-key") {
        return new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), {
          status: 200,
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    }) as typeof fetch)

    const { default: doctorCmd } = await import("../../src/commands/doctor")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    let written = ""
    try {
      await doctorCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof doctorCmd.run>>[0])
    } finally {
      written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      writeSpy.mockRestore()
      fetchSpy.mockRestore()
    }

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
