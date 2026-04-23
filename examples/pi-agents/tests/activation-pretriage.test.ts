import { describe, expect, test, vi } from "vitest"

import {
  createOutlitActivationPretriageTool,
  defaultActivationPretriageConfig,
  type OutlitActivationPretriageConfig,
  runOutlitActivationPretriage,
} from "../lib/activation-pretriage.js"

const fixedNow = new Date("2026-04-15T12:00:00Z")

describe("runOutlitActivationPretriage", () => {
  test("defaults activation scans to trialing, unpaid, and early paying accounts", () => {
    expect(
      defaultActivationPretriageConfig.scopeProfiles.activation_accounts.billingStatuses,
    ).toEqual(["NONE", "TRIALING", "PAYING"])
  })

  test("surfaces accounts with users but no activated users or activation events", async () => {
    const queryMock = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            customerId: "cust_stalled",
            customerName: "Stalled Co",
            domain: "stalled.example",
            billingStatus: "TRIALING",
            mrrCents: 0,
          },
          {
            customerId: "cust_activated",
            customerName: "Activated Co",
            domain: "activated.example",
            billingStatus: "TRIALING",
            mrrCents: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            customerId: "cust_stalled",
            usersObserved: 2,
            activatedUsers: 0,
            firstUserSeenAt: "2026-04-01T00:00:00Z",
            lastUserActivityAt: "2026-04-04T00:00:00Z",
          },
          {
            customerId: "cust_activated",
            usersObserved: 3,
            activatedUsers: 1,
            firstUserSeenAt: "2026-04-01T00:00:00Z",
            lastUserActivityAt: "2026-04-14T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            customerId: "cust_stalled",
            firstProductEventAt: "2026-04-01T00:00:00Z",
            lastProductEventAt: "2026-04-04T00:00:00Z",
            recentEventCount: 0,
            recentActiveDays: 0,
            activationEventCount: 0,
          },
          {
            customerId: "cust_activated",
            firstProductEventAt: "2026-04-01T00:00:00Z",
            lastProductEventAt: "2026-04-14T00:00:00Z",
            recentEventCount: 20,
            recentActiveDays: 5,
            activationEventCount: 1,
          },
        ],
      })

    const result = await runOutlitActivationPretriage({
      client: { callTool: queryMock },
      config: defaultActivationPretriageConfig,
      now: fixedNow,
      maxPromptCustomers: 5,
    })

    expect(queryMock).toHaveBeenCalledTimes(3)
    expect(queryMock.mock.calls[2]?.[1]).toMatchObject({
      sql: expect.stringContaining("'activated'"),
    })
    expect(queryMock.mock.calls[2]?.[1]).toMatchObject({
      sql: expect.stringContaining("parseDateTimeBestEffort('2026-04-15T12:00:00.000Z')"),
    })
    expect(result.summary).toMatchObject({
      totalSurfacedCustomers: 1,
      customersIncludedThisRun: 1,
      deferredCustomers: 0,
    })
    expect(result.surfacedCustomers).toEqual([
      expect.objectContaining({
        customerId: "cust_stalled",
        billingStatus: "TRIALING",
        signals: expect.arrayContaining([
          expect.objectContaining({ key: "noActivatedUsers" }),
          expect.objectContaining({ key: "noActivationEvent" }),
          expect.objectContaining({ key: "noRecentProductActivity" }),
        ]),
      }),
    ])
    expect(result.context).toContain("DETERMINISTIC ACTIVATION PRETRIAGE RESULTS")
    expect(result.context).toContain("BEGIN_ACTIVATION_PRETRIAGE_JSON")
    expect(result.context).toContain("The payload's activation metrics are hard behavior evidence")
  })

  test("validates local config before running SQL", async () => {
    const invalidConfig = {
      ...defaultActivationPretriageConfig,
      version: 99,
    } as unknown as OutlitActivationPretriageConfig
    const queryMock = vi.fn()

    await expect(
      runOutlitActivationPretriage({
        client: { callTool: queryMock },
        config: invalidConfig,
        now: fixedNow,
      }),
    ).rejects.toThrow("activation pretriage config version must be 1")
    expect(queryMock).not.toHaveBeenCalled()
  })
})

describe("createOutlitActivationPretriageTool", () => {
  test("formats deterministic activation pretriage results as a Pi tool result", async () => {
    const tool = createOutlitActivationPretriageTool({
      client: {
        callTool: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      },
      config: defaultActivationPretriageConfig,
      now: fixedNow,
    })

    const result = await tool.execute(
      "call_1",
      { scopeProfile: "activation_accounts", maxPromptCustomers: 5 },
      undefined,
      undefined,
      undefined as never,
    )

    expect(tool.name).toBe("outlit_activation_pretriage")
    expect(result.details.toolName).toBe("outlit_activation_pretriage")
    const content = result.content[0]
    expect(content).toEqual({
      type: "text",
      text: expect.stringContaining("Deterministic activation pretriage ran"),
    })
    if (content?.type !== "text") {
      throw new Error("Expected text content")
    }
    expect(content.text).toContain("Candidate accounting")
  })
})
