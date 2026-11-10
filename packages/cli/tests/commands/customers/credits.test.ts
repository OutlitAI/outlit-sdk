import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  customer: { id: "customer_1", name: "Acme Corp" },
  credits: {
    status: "available",
    asOf: "2026-11-10T00:00:00.000Z",
    data: { items: [], page: { hasMore: false, nextCursor: null, total: 0 }, complete: true },
  },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("customers credits (previous command)", () => {
  useTempEnv("credits-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("reads the credits section of get_customer", async () => {
    const { default: creditsCmd } = await import("../../../src/commands/customers/credits")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await creditsCmd.run!({
        args: { customer: " acme.com ", json: true },
      } as Parameters<NonNullable<typeof creditsCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_customer", {
        customer: "acme.com",
        include: ["credits"],
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
      expect(parsed.credits.status).toBe("available")
      expect(parsed.customer.id).toBe("customer_1")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("is hidden from help, which advertises customers get --include credits", async () => {
    const { default: creditsCmd } = await import("../../../src/commands/customers/credits")
    const meta =
      typeof creditsCmd.meta === "function" ? await creditsCmd.meta() : await creditsCmd.meta

    expect(meta?.hidden).toBe(true)
    expect(meta?.description).toContain("customers get <customer> --include credits")
  })
})
