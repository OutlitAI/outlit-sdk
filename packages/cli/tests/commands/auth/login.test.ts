// mock.module() must appear before any import statements — Bun hoists it.
import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [],
  pagination: { hasMore: false, nextCursor: null, total: 0 },
}))

function withoutCiEnvironment(): () => void {
  const previousCi = process.env.CI
  const previousGithubActions = process.env.GITHUB_ACTIONS
  Reflect.deleteProperty(process.env, "CI")
  Reflect.deleteProperty(process.env, "GITHUB_ACTIONS")

  return () => {
    if (previousCi === undefined) {
      Reflect.deleteProperty(process.env, "CI")
    } else {
      process.env.CI = previousCi
    }

    if (previousGithubActions === undefined) {
      Reflect.deleteProperty(process.env, "GITHUB_ACTIONS")
    } else {
      process.env.GITHUB_ACTIONS = previousGithubActions
    }
  }
}

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("auth login", () => {
  // useTempEnv sets OUTLIT_API_KEY, but login tests manage the key per-test
  useTempEnv("login-test")

  beforeEach(() => {
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    // Simulate piped stdout (non-interactive) so no @clack prompts are triggered
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("stores API key and writes success JSON when --key and --json are provided", async () => {
    const { default: loginCmd } = await import("../../../src/commands/auth/login")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), { status: 200 }),
    )

    try {
      await loginCmd.run!({
        args: { key: TEST_API_KEY, json: true },
      } as Parameters<NonNullable<typeof loginCmd.run>>[0])
    } finally {
      fetchSpy.mockRestore()
    }

    const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(parsed.success).toBe(true)
    expect(typeof parsed.config_path).toBe("string")
    writeSpy.mockRestore()
  })

  test("calls the non-billable validate-api-key endpoint to validate the key", async () => {
    const { default: loginCmd } = await import("../../../src/commands/auth/login")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), { status: 200 }),
    )
    let fetchCalls: Array<unknown[]> = []

    try {
      await loginCmd.run!({
        args: { key: TEST_API_KEY, json: false },
      } as Parameters<NonNullable<typeof loginCmd.run>>[0])
      fetchCalls = [...fetchSpy.mock.calls]
    } finally {
      fetchSpy.mockRestore()
    }

    expect(fetchCalls).toEqual([
      [
        "https://app.outlit.ai/api/validate-api-key",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        },
      ],
    ])
    expect(mockCallTool).not.toHaveBeenCalled()
    writeSpy.mockRestore()
  })

  test("starts browser auth by default in non-interactive non-CI mode without --key", async () => {
    const { default: loginCmd } = await import("../../../src/commands/auth/login")
    const restoreCiEnvironment = withoutCiEnvironment()
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requestId: "req_123",
            pollToken: "poll_token_123",
            userCode: "ABCD-1234",
            approveUrl: "https://app.outlit.ai/cli-auth?request=req_123",
            expiresAt: new Date(Date.now() + 5_000).toISOString(),
            intervalSeconds: 1,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "approved",
            apiKey: TEST_API_KEY,
            keyPrefix: "ok_aaa",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), { status: 200 }),
      )

    let fetchCalls: Array<unknown[]> = []
    let stdout = ""
    try {
      await loginCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof loginCmd.run>>[0])
      fetchCalls = [...fetchSpy.mock.calls]
      stdout = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      restoreCiEnvironment()
      fetchSpy.mockRestore()
      stderrSpy.mockRestore()
      writeSpy.mockRestore()
    }

    const parsed = JSON.parse(stdout) as Record<string, unknown>
    expect(parsed.success).toBe(true)
    expect(fetchCalls.map((call) => call[0])).toEqual([
      "https://app.outlit.ai/api/cli-auth/start",
      "https://app.outlit.ai/api/cli-auth/poll",
      "https://app.outlit.ai/api/validate-api-key",
    ])
  })

  test("exits 1 and outputs error JSON when in CI mode without --key", async () => {
    const { default: loginCmd } = await import("../../../src/commands/auth/login")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const previousCi = process.env.CI
    process.env.CI = "true"

    let thrown: unknown
    let stderrWritten = ""
    try {
      await loginCmd.run!({ args: { json: true } } as Parameters<
        NonNullable<typeof loginCmd.run>
      >[0])
    } catch (e) {
      thrown = e
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      if (previousCi === undefined) {
        Reflect.deleteProperty(process.env, "CI")
      } else {
        process.env.CI = previousCi
      }
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "missing_key")
  })

  test("browser auth works in non-interactive mode when --browser is provided", async () => {
    const { default: loginCmd } = await import("../../../src/commands/auth/login")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requestId: "req_123",
            pollToken: "poll_token_123",
            userCode: "ABCD-1234",
            approveUrl: "https://app.outlit.ai/cli-auth?request=req_123",
            expiresAt: new Date(Date.now() + 5_000).toISOString(),
            intervalSeconds: 1,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "approved",
            apiKey: TEST_API_KEY,
            keyPrefix: "ok_aaa",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, organizationId: "org_123" }), { status: 200 }),
      )

    let fetchCalls: Array<unknown[]> = []
    let stderrOutput = ""
    let stdout = ""
    try {
      await loginCmd.run!({
        args: { browser: true, json: true },
      } as Parameters<NonNullable<typeof loginCmd.run>>[0])
      fetchCalls = [...fetchSpy.mock.calls]
      stderrOutput = stderrSpy.mock.calls.map((call) => String(call[0])).join("")
      stdout = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      fetchSpy.mockRestore()
      stderrSpy.mockRestore()
      writeSpy.mockRestore()
    }

    const parsed = JSON.parse(stdout) as Record<string, unknown>
    expect(parsed.success).toBe(true)
    expect(typeof parsed.config_path).toBe("string")

    expect(fetchCalls.map((call) => call[0])).toEqual([
      "https://app.outlit.ai/api/cli-auth/start",
      "https://app.outlit.ai/api/cli-auth/poll",
      "https://app.outlit.ai/api/validate-api-key",
    ])
    expect(stderrOutput).toContain("https://app.outlit.ai/cli-auth?request=req_123")
    expect(stderrOutput).toContain("ABCD-1234")
  })

  test("exits with a validation error when browser auth fails server-side", async () => {
    const { default: loginCmd } = await import("../../../src/commands/auth/login")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requestId: "req_123",
            pollToken: "poll_token_123",
            userCode: "ABCD-1234",
            approveUrl: "https://app.outlit.ai/cli-auth?request=req_123",
            expiresAt: new Date(Date.now() + 5_000).toISOString(),
            intervalSeconds: 1,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "failed",
            error: "Could not verify CLI key before returning it.",
          }),
          { status: 200 },
        ),
      )

    let thrown: unknown
    let stderrWritten = ""
    try {
      await loginCmd.run!({
        args: { browser: true, json: true },
      } as Parameters<NonNullable<typeof loginCmd.run>>[0])
    } catch (e) {
      thrown = e
      const stderrOutput = stderrSpy.mock.calls.map((call) => String(call[0])).join("")
      const jsonStart = stderrOutput.indexOf("{")
      stderrWritten = jsonStart === -1 ? stderrOutput : stderrOutput.slice(jsonStart)
    } finally {
      fetchSpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "auth_failed")
    expect(stderrWritten).toContain("Could not verify CLI key before returning it.")
  })

  test("exits 1 when API key has wrong prefix", async () => {
    const { default: loginCmd } = await import("../../../src/commands/auth/login")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrWritten = ""
    try {
      await loginCmd.run!({ args: { key: "invalid_key_12345", json: true } } as Parameters<
        NonNullable<typeof loginCmd.run>
      >[0])
    } catch (e) {
      thrown = e
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "invalid_key_format")
  })
})
