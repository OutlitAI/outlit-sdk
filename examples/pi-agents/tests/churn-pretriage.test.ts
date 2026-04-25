import { describe, expect, test, vi } from "vitest"

import {
  createOutlitChurnPretriageTool,
  defaultChurnPretriageConfig,
  type OutlitChurnPretriageConfig,
  runOutlitChurnPretriage,
} from "../lib/churn-pretriage.js"

const fixedNow = new Date("2026-04-15T12:00:00Z")

describe("runOutlitChurnPretriage", () => {
  test("rotates capped prompt customers by full pages across hourly schedule windows", async () => {
    const firstRun = await runOutlitChurnPretriage({
      client: { callTool: createRotationQueryMock() },
      config: defaultChurnPretriageConfig,
      now: "2026-04-15T00:00:00Z",
      scopeProfile: "revenue_accounts",
      maxPromptCustomers: 2,
    })
    const secondRun = await runOutlitChurnPretriage({
      client: { callTool: createRotationQueryMock() },
      config: defaultChurnPretriageConfig,
      now: "2026-04-15T01:00:00Z",
      scopeProfile: "revenue_accounts",
      maxPromptCustomers: 2,
    })

    expect(firstRun.summary).toMatchObject({
      totalSurfacedCustomers: 5,
      customersIncludedThisRun: 2,
      deferredCustomers: 3,
    })
    const firstCustomerIds = firstRun.surfacedCustomers.map((customer) => customer.customerId)
    const secondCustomerIds = secondRun.surfacedCustomers.map((customer) => customer.customerId)

    expect(new Set([...firstCustomerIds, ...secondCustomerIds]).size).toBe(4)
  })

  test("honors configured prompt rotation windows", async () => {
    const config = {
      ...defaultChurnPretriageConfig,
      promptSelection: {
        rotationWindowHours: 2,
      },
    }
    const firstRun = await runOutlitChurnPretriage({
      client: { callTool: createRotationQueryMock() },
      config,
      now: "2026-04-15T00:00:00Z",
      scopeProfile: "revenue_accounts",
      maxPromptCustomers: 2,
    })
    const sameWindowRun = await runOutlitChurnPretriage({
      client: { callTool: createRotationQueryMock() },
      config,
      now: "2026-04-15T01:00:00Z",
      scopeProfile: "revenue_accounts",
      maxPromptCustomers: 2,
    })
    const nextWindowRun = await runOutlitChurnPretriage({
      client: { callTool: createRotationQueryMock() },
      config,
      now: "2026-04-15T02:00:00Z",
      scopeProfile: "revenue_accounts",
      maxPromptCustomers: 2,
    })

    expect(sameWindowRun.surfacedCustomers.map((customer) => customer.customerId)).toEqual(
      firstRun.surfacedCustomers.map((customer) => customer.customerId),
    )
    expect(
      new Set([
        ...firstRun.surfacedCustomers.map((customer) => customer.customerId),
        ...nextWindowRun.surfacedCustomers.map((customer) => customer.customerId),
      ]).size,
    ).toBe(4)
  })

  test("rotates investigate customers by remaining prompt slots after likely churn", async () => {
    const firstRun = await runOutlitChurnPretriage({
      client: { callTool: createMixedDispositionQueryMock() },
      config: defaultChurnPretriageConfig,
      now: "2026-04-15T00:00:00Z",
      scopeProfile: "revenue_accounts",
      maxPromptCustomers: 3,
    })
    const secondRun = await runOutlitChurnPretriage({
      client: { callTool: createMixedDispositionQueryMock() },
      config: defaultChurnPretriageConfig,
      now: "2026-04-15T01:00:00Z",
      scopeProfile: "revenue_accounts",
      maxPromptCustomers: 3,
    })

    expect(firstRun.surfacedCustomers.map((customer) => customer.customerId)).toEqual([
      "cust_likely",
      "cust_investigate_1",
      "cust_investigate_2",
    ])
    expect(secondRun.surfacedCustomers.map((customer) => customer.customerId)).toEqual([
      "cust_likely",
      "cust_investigate_3",
      "cust_investigate_4",
    ])
  })

  test("uses customer ID as a stable final ordering tiebreaker", async () => {
    const result = await runOutlitChurnPretriage({
      client: { callTool: createTiebreakerQueryMock() },
      config: defaultChurnPretriageConfig,
      now: "2026-04-15T00:00:00Z",
      scopeProfile: "revenue_accounts",
      maxPromptCustomers: 10,
    })

    expect(result.surfacedCustomers.map((customer) => customer.customerId)).toEqual([
      "cust_a",
      "cust_b",
      "cust_c",
    ])
  })

  test("surfaces customers with the same churn heuristic classes as the internal agent", async () => {
    const queryMock = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            customerId: "cust_past_due",
            customerName: "Past Due Co",
            domain: "pastdue.example",
            billingStatus: "PAST_DUE",
            mrrCents: 15000,
          },
          {
            customerId: "cust_low_activity",
            customerName: "Low Activity Co",
            domain: "low.example",
            billingStatus: "PAYING",
            mrrCents: 25000,
          },
          {
            customerId: "cust_drop",
            customerName: "Drop Co",
            domain: "drop.example",
            billingStatus: "PAYING",
            mrrCents: 35000,
          },
          {
            customerId: "cust_user_stale",
            customerName: "User Stale Co",
            domain: "user-stale.example",
            billingStatus: "PAYING",
            mrrCents: 45000,
          },
          {
            customerId: "cust_all_inactive",
            customerName: "All Inactive Co",
            domain: "all-inactive.example",
            billingStatus: "PAYING",
            mrrCents: 55000,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            customerId: "cust_low_activity",
            firstMeaningfulActivityAt: "2026-02-01T00:00:00Z",
            lastMeaningfulActivityAt: "2026-03-01T00:00:00Z",
            activeDays30d: 3,
            eventCount30d: 9,
          },
          {
            customerId: "cust_drop",
            firstMeaningfulActivityAt: "2026-01-01T00:00:00Z",
            lastMeaningfulActivityAt: "2026-04-14T00:00:00Z",
            activeDays30d: 10,
            eventCount30d: 25,
          },
          {
            customerId: "cust_user_stale",
            firstMeaningfulActivityAt: "2026-01-01T00:00:00Z",
            lastMeaningfulActivityAt: "2026-04-10T00:00:00Z",
            activeDays30d: 15,
            eventCount30d: 50,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            customerId: "cust_drop",
            currentActiveDays: 1,
            currentEventCount: 3,
            baselineActiveDays: 12,
            baselineEventCount: 40,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            customerId: "cust_user_stale",
            userId: "user_1",
            email: "stale@user-stale.example",
            name: "Stale User",
          },
          {
            customerId: "cust_all_inactive",
            userId: "user_2",
            email: "inactive-1@all-inactive.example",
            name: "Inactive One",
          },
          {
            customerId: "cust_all_inactive",
            userId: "user_3",
            email: "inactive-2@all-inactive.example",
            name: "Inactive Two",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            customerId: "cust_user_stale",
            userId: "user_1",
            lastMeaningfulActivityAt: "2026-04-05T00:00:00Z",
            activeDaysObserved: 4,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            customerId: "cust_all_inactive",
            userId: "user_2",
            lastActivityBeforeInactiveWindow: "2026-03-25T00:00:00Z",
            priorActiveDays: 3,
            priorEventCount: 5,
            recentEventCount: 0,
          },
          {
            customerId: "cust_all_inactive",
            userId: "user_3",
            lastActivityBeforeInactiveWindow: "2026-03-26T00:00:00Z",
            priorActiveDays: 4,
            priorEventCount: 8,
            recentEventCount: 0,
          },
        ],
      })

    const result = await runOutlitChurnPretriage({
      client: { callTool: queryMock },
      config: defaultChurnPretriageConfig,
      now: fixedNow,
      scopeProfile: "revenue_accounts",
      maxPromptCustomers: 10,
    })

    expect(queryMock).toHaveBeenCalledTimes(6)
    const generatedSql = queryMock.mock.calls
      .map((call) => (call[1] as { sql?: string } | undefined)?.sql ?? "")
      .join("\n")
    const normalizedSql = generatedSql.toLowerCase()
    expect(normalizedSql).toMatch(/\bfrom\s+customers\b|\bjoin\s+customers\b/)
    expect(normalizedSql).toMatch(/\bfrom\s+activity\b|\bjoin\s+activity\b/)
    expect(normalizedSql).toMatch(/\bfrom\s+users\b|\bjoin\s+users\b/)
    expect(normalizedSql).not.toMatch(/\bcustomer_dimensions\b/)
    expect(normalizedSql).not.toMatch(/\buser_dimensions\b/)
    expect(normalizedSql).not.toMatch(/\b(?:from|join)\s+events\b/)
    expect(normalizedSql).toContain("event_name")
    expect(normalizedSql).toContain("$autocapture")

    expect(result.summary).toMatchObject({
      totalSurfacedCustomers: 5,
      customersIncludedThisRun: 5,
      likelyChurnCustomers: 2,
      investigateCustomers: 3,
    })
    expect(result.context).toContain("BEGIN_PRETRIAGE_JSON")
    expect(result.context).toContain('"signals"')
    expect(result.context).not.toContain('"customerHeuristics"')
    expect(result.context).not.toContain('"fingerprint"')

    const byId = new Map(
      result.surfacedCustomers.map((customer) => [customer.customerId, customer]),
    )
    expect(byId.get("cust_past_due")?.customerHeuristics).toEqual([
      expect.objectContaining({ key: "pastDueBillingStatus", disposition: "likely_churn" }),
    ])
    expect(byId.get("cust_low_activity")?.customerHeuristics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "daysSinceLastMeaningfulActivity" }),
        expect.objectContaining({ key: "activeDaysLast30d" }),
      ]),
    )
    expect(byId.get("cust_drop")?.customerHeuristics).toEqual([
      expect.objectContaining({ key: "dropVsBaseline", disposition: "investigate" }),
    ])
    expect(byId.get("cust_user_stale")?.userHeuristics).toEqual([
      expect.objectContaining({
        key: "daysSinceLastMeaningfulActivity",
        matchedUsers: [
          expect.objectContaining({
            email: "stale@user-stale.example",
            daysSinceLastMeaningfulActivity: 10,
          }),
        ],
      }),
    ])
    expect(byId.get("cust_all_inactive")?.userHeuristics).toEqual([
      expect.objectContaining({
        key: "allRecentlyActiveUsersNowInactive",
        matchedUsers: [
          expect.objectContaining({ email: "inactive-1@all-inactive.example" }),
          expect.objectContaining({ email: "inactive-2@all-inactive.example" }),
        ],
      }),
    ])
  })

  test("validates local config before running SQL", async () => {
    const invalidConfig = {
      ...defaultChurnPretriageConfig,
      version: 99,
    } as unknown as OutlitChurnPretriageConfig
    const queryMock = vi.fn()

    await expect(
      runOutlitChurnPretriage({
        client: { callTool: queryMock },
        config: invalidConfig,
        now: fixedNow,
      }),
    ).rejects.toThrow("churn pretriage config version must be 2")
    expect(queryMock).not.toHaveBeenCalled()
  })

  test.each([
    {
      name: "auto scope interval",
      mutate: (config: OutlitChurnPretriageConfig) => {
        config.autoScopeSchedule.intervalHours = 5
      },
      message: "autoScopeSchedule.intervalHours must be a positive divisor of 24",
    },
    {
      name: "past due enabled flag",
      mutate: (config: OutlitChurnPretriageConfig) => {
        const pastDueBillingStatus = config.defaults.customerHeuristics
          .pastDueBillingStatus as unknown as {
          enabled: unknown
        }
        pastDueBillingStatus.enabled = "yes"
      },
      message: "pastDueBillingStatus.enabled must be a boolean",
    },
    {
      name: "active day minimum customer age",
      mutate: (config: OutlitChurnPretriageConfig) => {
        config.defaults.customerHeuristics.activeDaysLast30d.minimumCustomerAgeDays = -1
      },
      message: "activeDaysLast30d.minimumCustomerAgeDays must be a non-negative integer",
    },
    {
      name: "all users now inactive lookback",
      mutate: (config: OutlitChurnPretriageConfig) => {
        config.defaults.userHeuristics.allRecentlyActiveUsersNowInactive.lookbackDays = 0
      },
      message: "allRecentlyActiveUsersNowInactive.lookbackDays must be a positive integer",
    },
  ])("validates $name before running SQL", async ({ mutate, message }) => {
    const invalidConfig = structuredClone(defaultChurnPretriageConfig)
    const queryMock = vi.fn()
    mutate(invalidConfig)

    await expect(
      runOutlitChurnPretriage({
        client: { callTool: queryMock },
        config: invalidConfig,
        now: fixedNow,
      }),
    ).rejects.toThrow(message)
    expect(queryMock).not.toHaveBeenCalled()
  })
})

function createRotationQueryMock() {
  const directoryRows = Array.from({ length: 5 }, (_, index) => {
    const customerNumber = index + 1
    return {
      customerId: `cust_${customerNumber}`,
      customerName: `Customer ${customerNumber}`,
      domain: `customer-${customerNumber}.example`,
      billingStatus: "PAYING",
      mrrCents: 10000 + customerNumber,
    }
  })

  return vi
    .fn()
    .mockResolvedValueOnce({ rows: directoryRows })
    .mockResolvedValueOnce({
      rows: directoryRows.map((customer) => ({
        customerId: customer.customerId,
        firstMeaningfulActivityAt: "2026-01-01T00:00:00Z",
        lastMeaningfulActivityAt: "2026-02-01T00:00:00Z",
        activeDays30d: 0,
        eventCount30d: 0,
      })),
    })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
}

function createMixedDispositionQueryMock() {
  const investigateRows = Array.from({ length: 4 }, (_, index) => {
    const customerNumber = index + 1
    return {
      customerId: `cust_investigate_${customerNumber}`,
      customerName: `Investigate ${customerNumber}`,
      domain: `investigate-${customerNumber}.example`,
      billingStatus: "PAYING",
      mrrCents: 10000,
    }
  })

  return vi
    .fn()
    .mockResolvedValueOnce({
      rows: [
        {
          customerId: "cust_likely",
          customerName: "Likely Co",
          domain: "likely.example",
          billingStatus: "PAST_DUE",
          mrrCents: 10000,
        },
        ...investigateRows,
      ],
    })
    .mockResolvedValueOnce({
      rows: investigateRows.map((customer) => ({
        customerId: customer.customerId,
        firstMeaningfulActivityAt: "2026-01-01T00:00:00Z",
        lastMeaningfulActivityAt: "2026-04-14T00:00:00Z",
        activeDays30d: 10,
        eventCount30d: 25,
      })),
    })
    .mockResolvedValueOnce({
      rows: investigateRows.map((customer) => ({
        customerId: customer.customerId,
        currentActiveDays: 1,
        currentEventCount: 3,
        baselineActiveDays: 12,
        baselineEventCount: 40,
      })),
    })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
}

function createTiebreakerQueryMock() {
  const directoryRows = ["cust_c", "cust_b", "cust_a"].map((customerId) => ({
    customerId,
    customerName: customerId,
    domain: `${customerId}.example`,
    billingStatus: "PAYING",
    mrrCents: 10000,
  }))

  return vi
    .fn()
    .mockResolvedValueOnce({ rows: directoryRows })
    .mockResolvedValueOnce({
      rows: directoryRows.map((customer) => ({
        customerId: customer.customerId,
        firstMeaningfulActivityAt: "2026-01-01T00:00:00Z",
        lastMeaningfulActivityAt: "2026-02-01T00:00:00Z",
        activeDays30d: 10,
        eventCount30d: 25,
      })),
    })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
}

describe("createOutlitChurnPretriageTool", () => {
  test("formats deterministic pretriage results as a Pi tool result", async () => {
    const tool = createOutlitChurnPretriageTool({
      client: {
        callTool: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      },
      config: defaultChurnPretriageConfig,
      now: fixedNow,
    })

    const result = await tool.execute(
      "call_1",
      { scopeProfile: "revenue_accounts", maxPromptCustomers: 5 },
      undefined,
      undefined,
      undefined as never,
    )

    expect(tool.name).toBe("outlit_churn_pretriage")
    expect(result.details.toolName).toBe("outlit_churn_pretriage")
    const content = result.content[0]
    expect(content).toEqual({
      type: "text",
      text: expect.stringContaining("Deterministic churn pretriage ran"),
    })
    if (content?.type !== "text") {
      throw new Error("Expected text content")
    }
    expect(content.text).toContain("Candidate accounting")
    expect(content.text).toContain("Do not rank a customer")
  })
})
