// mock.module() must appear before any import statements — Bun hoists it.
import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  ExitError,
  TEST_API_KEY,
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [],
  pagination: { hasMore: false, nextCursor: null, total: 0 },
}))

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

    await loginCmd.run!({
      args: { key: TEST_API_KEY, json: true },
    } as Parameters<NonNullable<typeof loginCmd.run>>[0])

    const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(parsed.success).toBe(true)
    expect(typeof parsed.config_path).toBe("string")
    writeSpy.mockRestore()
  })

  test("calls outlit_list_customers to validate the key", async () => {
    const { default: loginCmd } = await import("../../../src/commands/auth/login")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    await loginCmd.run!({
      args: { key: TEST_API_KEY, json: false },
    } as Parameters<NonNullable<typeof loginCmd.run>>[0])

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_customers", { limit: 1 })
    writeSpy.mockRestore()
  })

  test("exits 1 and outputs error JSON when in non-interactive mode without --key", async () => {
    const { default: loginCmd } = await import("../../../src/commands/auth/login")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

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
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "missing_key")
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
