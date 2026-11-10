import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  expectErrorExit,
  mockExitThrow,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [
    {
      id: "p1",
      email: "alice@acme.com",
      name: "Alice",
      title: "VP Product",
      journeyStage: "engaged",
      customer: { id: "c1", name: "Acme", domain: "acme.com" },
      lastActivityAt: "2026-11-01T00:00:00.000Z",
      lastCommunication: { occurredAt: "2026-11-02T00:00:00.000Z", kind: "email" },
    },
  ],
  page: { hasMore: false, nextCursor: null, total: 1 },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("people list", () => {
  useTempEnv("users-list-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("flag-to-param mapping — all flags map to the v2 input", async () => {
    const { default: listCmd } = await import("../../../src/commands/people/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          "journey-stage": "ENGAGED,inactive",
          role: "champion",
          customer: "acme.com",
          "no-activity-in": "30d",
          "has-activity-in": "90d",
          search: "alice",
          "order-by": "first_synced_at",
          "order-direction": "asc",
          limit: "50",
          cursor: "next-page-cursor",
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_list_people", {
        customer: "acme.com",
        filters: {
          journeyStage: ["engaged", "inactive"],
          role: ["champion"],
          activity: { within: "90d", notWithin: "30d" },
          search: "alice",
        },
        orderBy: "first_synced_at",
        orderDirection: "asc",
        limit: 50,
        cursor: "next-page-cursor",
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test.each([
    ["12h", "hours"],
    ["30d", "days"],
    ["90m", "minutes"],
    ["3650d", "the largest day count"],
    ["99999m", "five digits"],
  ])("accepts %s (%s) for both activity flags", async (window) => {
    const { default: listCmd } = await import("../../../src/commands/people/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "has-activity-in": window, "no-activity-in": window, json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_people",
        expect.objectContaining({
          filters: { activity: { within: window, notWithin: window } },
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test.each([
    "12",
    "0d",
    "12x",
    "1.5h",
    "-3d",
    "100000d",
    "h",
    "12H",
    " 12h",
  ])("rejects %j with invalid_input and never lets process.exit escape the test", async (window) => {
    const { default: listCmd } = await import("../../../src/commands/people/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await listCmd.run!({
        args: { "has-activity-in": window, json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(stderrOutput).toContain("12h")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("accepts the previous --customer-id and first_seen_at spellings", async () => {
    const { default: listCmd } = await import("../../../src/commands/people/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "order-by": "first_seen_at", json: true },
        rawArgs: ["list", "--customer-id", "cust-uuid-123"],
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_people",
        expect.objectContaining({ customer: "cust-uuid-123", orderBy: "first_synced_at" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("maps --trait filters into trait field filters", async () => {
    const { default: listCmd } = await import("../../../src/commands/people/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          trait: "role=admin,onboarded=false,seats=3",
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const [[, params]] = mockCallTool.mock.calls as [[string, { filters: { fields: unknown } }]]
      expect(params.filters.fields).toEqual([
        { field: { source: "traits", key: "role" }, op: "eq", value: "admin" },
        { field: { source: "traits", key: "onboarded" }, op: "eq", value: false },
        { field: { source: "traits", key: "seats" }, op: "eq", value: 3 },
      ])
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("omits filters when --trait is only whitespace", async () => {
    const { default: listCmd } = await import("../../../src/commands/people/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          trait: "   ",
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const [[, params]] = mockCallTool.mock.calls as [[string, Record<string, unknown>]]
      expect(params).not.toHaveProperty("filters")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test.each([
    ["--journey-stage", { "journey-stage": "CHAMPION" }],
    ["--role", { role: "boss" }],
    ["--has-activity-in", { "has-activity-in": "last week" }],
  ])("rejects an invalid %s before calling Core", async (_flag, flags) => {
    const { default: listCmd } = await import("../../../src/commands/people/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await listCmd.run!({
        args: { json: true, ...flags },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  })

  test("the previous `users` command runs the same list but is hidden from help", async () => {
    const { default: usersCmd } = await import("../../../src/commands/users/index")
    const { default: listCmd } = await import("../../../src/commands/people/list")
    const meta = typeof usersCmd.meta === "function" ? await usersCmd.meta() : await usersCmd.meta
    const subCommands =
      typeof usersCmd.subCommands === "function"
        ? await usersCmd.subCommands()
        : await usersCmd.subCommands
    const list = await (subCommands?.list as () => Promise<unknown>)()

    expect(meta?.hidden).toBe(true)
    expect(list).toBe(listCmd)
  })

  test("auth_required error on createClient failure", async () => {
    const clientModule = await import("../../../src/lib/client")
    const createClientSpy = spyOn(clientModule, "createClient").mockRejectedValue(
      new Error("No API key found. Run `outlit auth login` or set OUTLIT_API_KEY."),
    )
    const { default: listCmd } = await import("../../../src/commands/people/list")
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
    const { default: listCmd } = await import("../../../src/commands/people/list")
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
      expect(output).toContain("Last Contact")
      expect(output).toContain("alice@acme.com")
      expect(output).toContain("Alice")
      expect(output).toContain("VP Product")
      expect(output).toContain("engaged")
      expect(output).toContain("Acme")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })
})
