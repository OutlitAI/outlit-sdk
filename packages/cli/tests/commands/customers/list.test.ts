import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { runCommand } from "citty"
import {
  expectErrorExit,
  mockExitThrow,
  runExpectingError,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [
    {
      id: "1",
      name: "Acme",
      domain: "acme.com",
      billingStatus: "PAYING",
      activatedAt: null,
    },
  ],
  pagination: { hasMore: false, nextCursor: null, total: 1 },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("customers list", () => {
  useTempEnv("list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("calls outlit_list_customers with billingStatus when --billing-status is set", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "billing-status": "PAYING", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ billingStatus: "PAYING" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes mrrAbove as number when --mrr-above is set", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "mrr-above": "10000", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ mrrAbove: 10000 }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes noActivityInLast when --no-activity-in is set", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "no-activity-in": "30d", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ noActivityInLast: "30d" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes owner filters when owner flags are set", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          "owner-id": "user_123",
          "owner-email": "kevin@nooks.ai",
          "has-owner": true,
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({
          ownerId: "user_123",
          ownerEmail: "kevin@nooks.ai",
          hasOwner: true,
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes an ISO-8601 --activated-since timestamp to the customer tool", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await runCommand(listCmd, {
        rawArgs: ["--activated-since", "2026-07-01T00:00:00.000Z", "--json"],
      })

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ activatedSince: "2026-07-01T00:00:00.000Z" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("accepts an ISO-8601 --activated-since timestamp with an offset", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await runCommand(listCmd, {
        rawArgs: ["--activated-since", "2026-07-01T00:00:00+05:30", "--json"],
      })

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ activatedSince: "2026-07-01T00:00:00+05:30" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  for (const [label, activatedSince] of [
    ["malformed", "last-week"],
    ["date-only", "2026-07-01"],
    ["whitespace-only", "   "],
    ["whitespace-padded", " 2026-07-01T00:00:00Z "],
  ] as const) {
    test(`rejects ${label} --activated-since before calling the customer tool`, async () => {
      const { default: listCmd } = await import("../../../src/commands/customers/list")

      await runExpectingError(async () => {
        await listCmd.run!({
          args: { "activated-since": activatedSince, json: true },
        } as Parameters<NonNullable<typeof listCmd.run>>[0])
      }, "invalid_input")

      expect(mockCallTool).not.toHaveBeenCalled()
    })
  }

  test("parses --no-activity-in through citty without treating it as a negated boolean", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await runCommand(listCmd, {
        rawArgs: ["--no-activity-in", "30d", "--limit", "3", "--json"],
      })

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ noActivityInLast: "30d", limit: 3 }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("uses the last repeated --no-activity-in value from raw args", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await runCommand(listCmd, {
        rawArgs: ["--no-activity-in", "14d", "--no-activity-in", "30d", "--json"],
      })

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ noActivityInLast: "30d" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("normalizes future last activity values in customer list output", async () => {
    mockCallTool.mockImplementationOnce(async () => ({
      items: [
        {
          id: "1",
          name: "Future Activity",
          domain: "future.example",
          billingStatus: "NONE",
          activatedAt: null,
          lastActivityAt: "2026-05-05 19:00:00.000",
          daysSinceActivity: -9,
        },
      ],
      pagination: { hasMore: false, nextCursor: null, total: 1 },
    }))

    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const parsed = JSON.parse(written) as {
        items: Array<{ lastActivityAt: string | null; daysSinceActivity: number | null }>
      }
      expect(parsed.items[0]?.lastActivityAt).toBeNull()
      expect(parsed.items[0]?.daysSinceActivity).toBeNull()
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("maps --trait filters into traitFilters params", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { trait: "segment=enterprise,active=true,seats=25", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({
          traitFilters: {
            segment: "enterprise",
            active: true,
            seats: 25,
          },
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("omits traitFilters when --trait is only whitespace", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          trait: "   ",
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const [[, params]] = mockCallTool.mock.calls as [[string, Record<string, unknown>]]
      expect(params).not.toHaveProperty("traitFilters")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("outputs JSON result to stdout", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const parsed = JSON.parse(written) as Record<string, unknown>
      expect(Array.isArray(parsed.items)).toBe(true)
      expect((parsed.items as Array<Record<string, unknown>>)[0]?.activatedAt).toBeNull()
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("auto-outputs JSON when non-interactive (no --json flag)", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      // setNonInteractive() is called in beforeEach, so no --json needed
      await listCmd.run!({
        args: {},
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(writeSpy).toHaveBeenCalled()
      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      expect(() => JSON.parse(written)).not.toThrow()
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("exits 1 when API call fails", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (401): Unauthorized")
    })

    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    let stderrWritten = ""
    try {
      await listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "api_error")
  })

  test("renders table with box-drawing characters in interactive mode", async () => {
    setInteractive()
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await listCmd.run!({
        args: {},
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const output = logSpy.mock.calls.map((c) => c[0] as string).join("\n")
      expect(output).toContain("┌")
      expect(output).toContain("Name")
      expect(output).toContain("Domain")
      expect(output).toContain("Billing")
      expect(output).toContain("Acme")
      expect(output).toContain("acme.com")
      expect(output).toContain("PAYING")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })
})
