import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [
    { name: "Stripe", category: "billing", status: "connected", lastDataReceivedAt: null },
    { name: "Slack", category: "communication", status: "not_connected", lastDataReceivedAt: null },
  ],
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("integrations list", () => {
  useTempEnv("integrations-list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("calls outlit_list_integrations", async () => {
    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    await captureStdout(() =>
      listCmd.run!({ args: { json: true } } as Parameters<NonNullable<typeof listCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_integrations", {})
  })

  test("outputs JSON result to stdout", async () => {
    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    const parsed = await captureStdout(() =>
      listCmd.run!({ args: { json: true } } as Parameters<NonNullable<typeof listCmd.run>>[0]),
    )

    expect(Array.isArray(parsed.items)).toBe(true)
  })

  test("auto-outputs JSON when non-interactive", async () => {
    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    const parsed = await captureStdout(() =>
      listCmd.run!({ args: {} } as Parameters<NonNullable<typeof listCmd.run>>[0]),
    )

    expect(parsed.items).toBeDefined()
  })

  test("renders table in interactive mode", async () => {
    setInteractive()
    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await listCmd.run!({ args: {} } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const output = logSpy.mock.calls.map((c) => c[0] as string).join("\n")
      expect(output).toContain("┌")
      expect(output).toContain("Name")
      expect(output).toContain("Category")
      expect(output).toContain("Status")
      expect(output).toContain("Stripe")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })

  test("exits 1 when API call fails", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (401): Unauthorized")
    })

    const { default: listCmd } = await import("../../../src/commands/integrations/list")
    await runExpectingError(
      () =>
        listCmd.run!({ args: { json: true } } as Parameters<NonNullable<typeof listCmd.run>>[0]),
      "api_error",
    )
  })
})
