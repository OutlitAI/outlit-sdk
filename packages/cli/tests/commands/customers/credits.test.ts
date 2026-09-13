import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  customer: { id: "customer_1", name: "Acme Corp" },
  status: "available",
  credits: [],
  truncated: false,
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("customers credits", () => {
  useTempEnv("credits-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("requests the exact customer credit contract", async () => {
    const { default: creditsCmd } = await import("../../../src/commands/customers/credits")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await creditsCmd.run!({
        args: { customer: " acme.com ", json: true },
      } as Parameters<NonNullable<typeof creditsCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_customer_credits", {
        customer: "acme.com",
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("writes the tool result unchanged as JSON", async () => {
    const { default: creditsCmd } = await import("../../../src/commands/customers/credits")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await creditsCmd.run!({
        args: { customer: "acme.com", json: true },
      } as Parameters<NonNullable<typeof creditsCmd.run>>[0])

      const parsed = JSON.parse((writeSpy.mock.calls[0]?.[0] as string) ?? "")
      expect(parsed).toEqual({
        customer: { id: "customer_1", name: "Acme Corp" },
        status: "available",
        credits: [],
        truncated: false,
      })
    } finally {
      writeSpy.mockRestore()
    }
  })
})
