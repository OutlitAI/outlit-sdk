import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  success: true,
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("integrations remove", () => {
  useTempEnv("integrations-remove-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("rejects unknown provider", async () => {
    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    await runExpectingError(
      () =>
        removeCmd.run!({
          args: { provider: "nonexistent", yes: true, json: true },
        } as Parameters<NonNullable<typeof removeCmd.run>>[0]),
      "unknown_provider",
    )
  })

  test("requires --yes in non-interactive mode", async () => {
    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    await runExpectingError(
      () =>
        removeCmd.run!({
          args: { provider: "salesforce", json: true },
        } as Parameters<NonNullable<typeof removeCmd.run>>[0]),
      "confirmation_required",
    )
  })

  test("disconnects with --yes flag", async () => {
    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    const parsed = await captureStdout(() =>
      removeCmd.run!({
        args: { provider: "salesforce", yes: true, json: true },
      } as Parameters<NonNullable<typeof removeCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_disconnect_integration", {
      provider: "salesforce",
    })
    expect(parsed.success).toBe(true)
    expect(parsed.provider).toBe("salesforce")
  })

  test("resolves gmail alias to google-mail for disconnect", async () => {
    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    await captureStdout(() =>
      removeCmd.run!({
        args: { provider: "gmail", yes: true, json: true },
      } as Parameters<NonNullable<typeof removeCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_disconnect_integration", {
      provider: "google-mail",
    })
  })

  test("exits 1 when disconnect fails", async () => {
    mockCallTool.mockImplementationOnce(async () => ({
      success: false,
      message: "Integration not found",
    }))

    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    await runExpectingError(
      () =>
        removeCmd.run!({
          args: { provider: "salesforce", yes: true, json: true },
        } as Parameters<NonNullable<typeof removeCmd.run>>[0]),
      "disconnect_failed",
    )
  })

  test("exits 1 when API call throws", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (500): Server Error")
    })

    const { default: removeCmd } = await import("../../../src/commands/integrations/remove")
    await runExpectingError(
      () =>
        removeCmd.run!({
          args: { provider: "salesforce", yes: true, json: true },
        } as Parameters<NonNullable<typeof removeCmd.run>>[0]),
      "api_error",
    )
  })
})
