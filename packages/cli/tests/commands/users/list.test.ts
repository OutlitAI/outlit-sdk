import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  TEST_API_KEY,
  expectErrorExit,
  mockExitThrow,
  setInteractive,
  setNonInteractive,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [{ id: "u1", email: "alice@acme.com", name: "Alice", journeyStage: "CHAMPION" }],
  pagination: { hasMore: false, nextCursor: null, total: 1 },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("users list", () => {
  useTempEnv("users-list-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("flag-to-param mapping — all flags map to correct API params", async () => {
    const { default: listCmd } = await import("../../../src/commands/users/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          "journey-stage": "CHAMPION",
          "customer-id": "cust-uuid-123",
          "no-activity-in": "30d",
          "has-activity-in": "7d",
          search: "alice",
          "order-by": "first_seen_at",
          "order-direction": "asc",
          limit: "50",
          cursor: "next-page-cursor",
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_users",
        expect.objectContaining({
          journeyStage: "CHAMPION",
          customerId: "cust-uuid-123",
          noActivityInLast: "30d",
          hasActivityInLast: "7d",
          search: "alice",
          orderBy: "first_seen_at",
          orderDirection: "asc",
          limit: 50,
          cursor: "next-page-cursor",
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("auth_required error on createClient failure", async () => {
    const clientModule = await import("../../../src/lib/client")
    const createClientSpy = spyOn(clientModule, "createClient").mockRejectedValue(
      new Error("No API key found. Run `outlit auth login` or set OUTLIT_API_KEY."),
    )
    const { default: listCmd } = await import("../../../src/commands/users/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      createClientSpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "auth_required")
    }
  })

  test("renders table with box-drawing characters in interactive mode", async () => {
    setInteractive()
    const { default: listCmd } = await import("../../../src/commands/users/list")
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await listCmd.run!({
        args: {},
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const output = logSpy.mock.calls.map((c) => c[0] as string).join("\n")
      expect(output).toContain("┌")
      expect(output).toContain("Email")
      expect(output).toContain("Name")
      expect(output).toContain("Journey")
      expect(output).toContain("alice@acme.com")
      expect(output).toContain("Alice")
      expect(output).toContain("CHAMPION")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })
})
