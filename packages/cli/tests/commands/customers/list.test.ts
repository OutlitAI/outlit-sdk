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
      billingStatus: "paying",
      activatedAt: null,
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

describe("customers list", () => {
  useTempEnv("list-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("sends --billing-status as lowercase filters.billingStatus, accepting the old uppercase", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "billing-status": "PAYING", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ filters: { billingStatus: ["paying"] } }),
      )

      mockCallTool.mockClear()
      await listCmd.run!({
        args: { "billing-status": "paying,past_due", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ filters: { billingStatus: ["paying", "past_due"] } }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("still maps the previously published --mrr-above spelling to twelve months of it", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { json: true },
        rawArgs: ["--mrr-above", "10000"],
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ filters: { arr: { above: 120000 } } }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes filters.arr above and below as numbers", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "arr-above": "1200000", "arr-below": "5000000", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ filters: { arr: { above: 1200000, below: 5000000 } } }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes --currency as filters.arr.currency and maps the old arr_cents sort to arr", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { currency: "EUR", "order-by": "arr_cents", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ filters: { arr: { currency: "EUR" } }, orderBy: "arr" }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("rejects a --currency that isn't a three-letter code before calling the customer tool", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")

    await runExpectingError(async () => {
      await listCmd.run!({
        args: { currency: "euros", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])
    }, "invalid_input")

    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("still maps the previously published --mrr-below spelling to twelve months of it", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { json: true },
        rawArgs: ["--mrr-below=2500"],
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ filters: { arr: { below: 30000 } } }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("passes filters.activity.notWithin when --no-activity-in is set", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "no-activity-in": "30d", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ filters: { activity: { notWithin: "30d" } } }),
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
          filters: { owner: { id: "user_123", email: "kevin@nooks.ai", has: true } },
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
        expect.objectContaining({
          filters: { activity: { activatedSince: "2026-07-01T00:00:00.000Z" } },
        }),
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
        expect.objectContaining({
          filters: { activity: { activatedSince: "2026-07-01T00:00:00+05:30" } },
        }),
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

  for (const [label, args, rawArgs] of [
    ["empty --arr-above=", { "arr-above": "" }, ["--arr-above="]],
    ["valueless --arr-below", { "arr-below": "" }, ["--arr-below"]],
    ["non-numeric --arr-above", { "arr-above": "lots" }, ["--arr-above", "lots"]],
    ["empty --mrr-above=", {}, ["--mrr-above="]],
    ["valueless --mrr-above", {}, ["--mrr-above"]],
    ["--mrr-below followed by another flag", {}, ["--mrr-below", "--limit", "5"]],
  ] as const) {
    test(`rejects ${label} before calling the customer tool`, async () => {
      const { default: listCmd } = await import("../../../src/commands/customers/list")

      await runExpectingError(async () => {
        await listCmd.run!({
          args: { ...args, json: true },
          rawArgs: [...rawArgs],
        } as Parameters<NonNullable<typeof listCmd.run>>[0])
      }, "invalid_input")

      expect(mockCallTool).not.toHaveBeenCalled()
    })
  }

  test("accepts a zero ARR threshold", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { "arr-above": "0", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ filters: { arr: { above: 0 } } }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("parses --no-activity-in through citty without treating it as a negated boolean", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await runCommand(listCmd, {
        rawArgs: ["--no-activity-in", "30d", "--limit", "3", "--json"],
      })

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({ filters: { activity: { notWithin: "30d" } }, limit: 3 }),
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
        expect.objectContaining({ filters: { activity: { notWithin: "30d" } } }),
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
          billingStatus: "none",
          activatedAt: null,
          lastActivityAt: "2026-05-05 19:00:00.000",
          daysSinceActivity: -9,
        },
      ],
      page: { hasMore: false, nextCursor: null, total: 1 },
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

  test("maps --trait filters into filters.fields trait equality filters", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: { trait: "segment=enterprise,active=true,seats=25", json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({
          filters: {
            fields: [
              { field: { source: "traits", key: "segment" }, op: "eq", value: "enterprise" },
              { field: { source: "traits", key: "active" }, op: "eq", value: true },
              { field: { source: "traits", key: "seats" }, op: "eq", value: 25 },
            ],
          },
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("omits filters when --trait is only whitespace", async () => {
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
      expect(params).not.toHaveProperty("filters")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("maps --search, --has-activity-in and the old first_seen_at sort", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          search: "acme",
          "has-activity-in": "7d",
          "order-by": "first_seen_at",
          "order-direction": "asc",
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_customers",
        expect.objectContaining({
          filters: { search: "acme", activity: { within: "7d" } },
          orderBy: "first_synced_at",
          orderDirection: "asc",
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("maps the renewal window flags and sends no direction unless asked", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          "renews-in": "next_90d",
          "renews-after": "2027-01-01",
          "renews-before": "2027-04-01",
          "order-by": "renewal_date",
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const [[, params]] = mockCallTool.mock.calls as [[string, Record<string, unknown>]]
      expect(params).toMatchObject({
        filters: {
          renewal: { within: "next_90d", after: "2027-01-01", before: "2027-04-01" },
        },
        orderBy: "renewal_date",
      })
      expect(params).not.toHaveProperty("orderDirection")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test.each([
    ["--renews-in", { "renews-in": "next_7d" }],
    ["--renews-after", { "renews-after": "next year" }],
    ["--renews-before", { "renews-before": "2027-13-45" }],
  ])("rejects an invalid %s before calling Core", async (_flag, flags) => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
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

  test("advertises only the current sort names", async () => {
    const { default: listCmd } = await import("../../../src/commands/customers/list")
    const meta = typeof listCmd.meta === "function" ? await listCmd.meta() : await listCmd.meta
    const description = meta?.description ?? ""

    expect(description).toContain("last_activity_at, first_synced_at, name, arr")
    expect(description).not.toContain("arr_cents")
    expect(description).not.toContain("first_seen_at")
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
    mockCallTool.mockImplementationOnce(
      async () =>
        ({
          items: [
            {
              id: "1",
              name: "Acme",
              domain: "acme.com",
              billingStatus: "paying",
              activatedAt: null,
              arr: {
                value: { amount: 1200000, currency: "USD", decimals: 2, formatted: "$12,000.00" },
                estimated: false,
                lifecycle: "active",
              },
            },
          ],
          page: { hasMore: false, nextCursor: null, total: 1 },
        }) as never,
    )
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
      expect(output).toContain("ARR")
      expect(output).toContain("$12,000.00")
      expect(output).toContain("Acme")
      expect(output).toContain("acme.com")
      expect(output).toContain("paying")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })
})
