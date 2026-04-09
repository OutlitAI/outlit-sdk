import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  source: { sourceType: "CALL", sourceId: "call_123" },
}))

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("sources get", () => {
  useTempEnv("sources-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("sends canonical source lookup to outlit_get_source", async () => {
    const { default: sourcesGetCmd } = await import("../../src/commands/sources/get")

    await captureStdout(() =>
      sourcesGetCmd.run!({
        args: {
          "source-type": "CALL",
          "source-id": "call_123",
          json: true,
        },
      } as Parameters<NonNullable<typeof sourcesGetCmd.run>>[0]),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_source", {
      sourceType: "CALL",
      sourceId: "call_123",
    })
  })
})
