import { matchesGeneratedJsonSchema, publicToolContracts } from "@outlit/tools"
import { describe, expect, test } from "vitest"

import {
  buildBillingScopeFilter,
  buildFingerprint,
  createPretriageClient,
  normalizeEventNames,
  normalizeNow,
  queryRows,
  toSqlDateTime,
  toSqlStringList,
} from "../lib/pretriage-utils.js"

describe("pretriage utilities", () => {
  test("reads SQL data through the current tool client contract", async () => {
    const data = [{ customerId: "cust_123" }]
    const response = {
      success: true,
      data,
      metadata: { rowsReturned: 1, executionTimeMs: 1, truncated: false },
    }
    expect(
      matchesGeneratedJsonSchema(response, publicToolContracts.outlit_query.outputSchema),
    ).toBe(true)
    const client = createPretriageClient(
      {
        apiKey: "ok_test",
        fetch: async () => new Response(JSON.stringify(response)),
      },
      "test",
    )

    expect(await queryRows(client, "SELECT customer_id AS customerId FROM customers")).toEqual(data)
  })

  test("normalizes event names for deterministic SQL filters", () => {
    expect(normalizeEventNames([" Onboarding_Completed ", "", "CUSTOM_EVENT"])).toEqual([
      "onboarding_completed",
      "custom_event",
    ])
  })

  test("escapes SQL string lists", () => {
    expect(toSqlStringList(["onboarding_completed", "customer's_event"])).toBe(
      "'onboarding_completed', 'customer''s_event'",
    )
  })

  test("formats dates for SQL comparisons", () => {
    expect(toSqlDateTime(new Date("2026-04-23T19:45:12.123Z"))).toBe(
      "parseDateTimeBestEffort('2026-04-23T19:45:12.123Z')",
    )
  })

  test("builds stable fingerprints independent of key order", () => {
    expect(buildFingerprint(["b", "a", "b"])).toBe(buildFingerprint(["b", "b", "a"]))
  })

  test("builds reusable billing scope SQL filters", () => {
    expect(buildBillingScopeFilter({ billingStatuses: ["PAYING"] })).toMatchObject({
      customers: "billing_status IN ('PAYING')",
      activity: expect.stringContaining("billing_status IN ('PAYING')"),
      users: expect.stringContaining("billing_status IN ('PAYING')"),
    })
  })

  test("normalizes timezone-less now strings as UTC", () => {
    expect(normalizeNow("2026-04-01T00:00:00").toISOString()).toBe("2026-04-01T00:00:00.000Z")
  })

  test("rejects invalid Date instances for now", () => {
    expect(() => normalizeNow(new Date("invalid"))).toThrow("now must be a valid date")
  })
})
