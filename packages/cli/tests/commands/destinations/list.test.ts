import { beforeEach, describe, expect, mock, test } from "bun:test"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const destinationId = "10000000-0000-4000-8000-000000000003"
const mockResult = {
  destinations: [
    {
      id: destinationId,
      name: "Ops webhook",
      provider: "OUTPOST",
      kind: "WEBHOOK_ENDPOINT",
      enabled: true,
      maskedConfig: { url: "https://hooks.example.com/..." },
      syncStatus: "SYNCED",
      updatedAt: "2026-06-28T12:00:00.000Z",
    },
  ],
}
const mockCallTool = mock(async () => mockResult)

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("destinations list", () => {
  useTempEnv("destinations-list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("lists the catalog-projected masked destinations", async () => {
    const { default: command } = await import("../../../src/commands/destinations/list")
    const parsed = await captureStdout<typeof mockResult>(() =>
      command.run!({ args: { json: true } } as never),
    )

    expect(mockCallTool).toHaveBeenCalledWith("outlit_list_destinations", {})
    expect(parsed.destinations[0]).toMatchObject({
      id: destinationId,
      provider: "OUTPOST",
      maskedConfig: { url: "https://hooks.example.com/..." },
    })
    expect(JSON.stringify(parsed)).not.toContain("configJson")
  })
})
