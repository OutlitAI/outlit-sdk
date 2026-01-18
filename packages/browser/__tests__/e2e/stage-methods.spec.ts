/**
 * Stage Methods E2E Tests
 *
 * Tests the stage tracking methods (activate, engaged, inactive)
 * to ensure they correctly send stage events to the API.
 */

import { type Request, type Route, expect, test } from "@playwright/test"

interface StageEvent {
  type: "stage"
  stage: string
  path?: string
  properties?: Record<string, unknown>
}

interface BillingEvent {
  type: "billing"
  status: string
  domain?: string
  customerId?: string
  stripeCustomerId?: string
  path?: string
  properties?: Record<string, unknown>
}

interface ApiCall {
  url: string
  payload: {
    visitorId?: string
    source?: string
    events?: Array<StageEvent | Record<string, unknown>>
  }
}

// Helper to intercept and collect API calls
async function interceptApiCalls(page: import("@playwright/test").Page): Promise<ApiCall[]> {
  const apiCalls: ApiCall[] = []

  await page.route("**/api/i/v1/**/events", async (route: Route) => {
    const request: Request = route.request()
    const postData = request.postData()

    apiCalls.push({
      url: request.url(),
      payload: postData ? JSON.parse(postData) : {},
    })

    // Return success response
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, processed: 1 }),
    })
  })

  return apiCalls
}

// ============================================
// STAGE METHOD TESTS
// ============================================

test.describe("Stage Methods", () => {
  test("inactive() sends stage event with properties", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-123" })
      window.outlit.user.inactive({ reason: "cancelled", plan: "pro" })
    })

    // Force flush
    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvent = allEvents.find(
      (e): e is StageEvent => e.type === "stage" && (e as StageEvent).stage === "inactive",
    )

    expect(stageEvent).toBeDefined()
    expect(stageEvent?.type).toBe("stage")
    expect(stageEvent?.stage).toBe("inactive")
    expect(stageEvent?.properties?.reason).toBe("cancelled")
    expect(stageEvent?.properties?.plan).toBe("pro")
  })

  test("inactive() requires user identity (logs warning)", async ({ page }) => {
    const warnings: string[] = []

    // Set up console listener before navigation
    page.on("console", (msg) => {
      if (msg.type() === "warning") warnings.push(msg.text())
    })

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Call inactive without setting user identity
    await page.evaluate(() => {
      window.outlit.user.inactive({ reason: "test" })
    })

    // Wait for warning to be logged
    await page.waitForTimeout(100)

    expect(warnings.some((w) => w.includes("setUser") || w.includes("identify"))).toBe(true)
  })

  test("activate() sends stage event", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-activate" })
      window.outlit.user.activate({ milestone: "onboarding_complete" })
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvent = allEvents.find(
      (e): e is StageEvent => e.type === "stage" && (e as StageEvent).stage === "activated",
    )

    expect(stageEvent).toBeDefined()
    expect(stageEvent?.type).toBe("stage")
    expect(stageEvent?.stage).toBe("activated")
    expect(stageEvent?.properties?.milestone).toBe("onboarding_complete")
  })

  test("engaged() sends stage event", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-engaged" })
      window.outlit.user.engaged({ sessions: 10 })
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvent = allEvents.find(
      (e): e is StageEvent => e.type === "stage" && (e as StageEvent).stage === "engaged",
    )

    expect(stageEvent).toBeDefined()
    expect(stageEvent?.type).toBe("stage")
    expect(stageEvent?.stage).toBe("engaged")
    expect(stageEvent?.properties?.sessions).toBe(10)
  })

  test("paid() sends billing event", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.customer.paid({ domain: "outlit.ai", properties: { plan: "enterprise" } })
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const billingEvent = allEvents.find(
      (e): e is BillingEvent => e.type === "billing" && (e as BillingEvent).status === "paid",
    )

    expect(billingEvent).toBeDefined()
    expect(billingEvent?.type).toBe("billing")
    expect(billingEvent?.status).toBe("paid")
    expect(billingEvent?.domain).toBe("outlit.ai")
  })

  test("trialing() sends billing event with customerId", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.customer.trialing({ customerId: "cust_123", properties: { plan: "pro" } })
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const billingEvent = allEvents.find(
      (e): e is BillingEvent => e.type === "billing" && (e as BillingEvent).status === "trialing",
    )

    expect(billingEvent).toBeDefined()
    expect(billingEvent?.type).toBe("billing")
    expect(billingEvent?.status).toBe("trialing")
    expect(billingEvent?.customerId).toBe("cust_123")
    expect(billingEvent?.properties?.plan).toBe("pro")
  })

  test("churned() sends billing event with stripeCustomerId", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.customer.churned({
        stripeCustomerId: "cus_stripe_abc",
        properties: { reason: "cancelled" },
      })
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const billingEvent = allEvents.find(
      (e): e is BillingEvent => e.type === "billing" && (e as BillingEvent).status === "churned",
    )

    expect(billingEvent).toBeDefined()
    expect(billingEvent?.type).toBe("billing")
    expect(billingEvent?.status).toBe("churned")
    expect(billingEvent?.stripeCustomerId).toBe("cus_stripe_abc")
    expect(billingEvent?.properties?.reason).toBe("cancelled")
  })

  test("customer.* methods require at least one identifier (logs warning)", async ({ page }) => {
    const warnings: string[] = []

    page.on("console", (msg) => {
      if (msg.type() === "warning") warnings.push(msg.text())
    })

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Call paid without any identifier
    await page.evaluate(() => {
      window.outlit.customer.paid({})
    })

    await page.waitForTimeout(100)

    expect(
      warnings.some(
        (w) => w.includes("customerId") || w.includes("stripeCustomerId") || w.includes("domain"),
      ),
    ).toBe(true)
  })

  test("all stage methods work in sequence: activate, engaged, inactive", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-lifecycle" })
      window.outlit.user.activate()
      window.outlit.user.engaged()
      window.outlit.user.inactive()
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvents = allEvents.filter((e): e is StageEvent => e.type === "stage")
    const stages = stageEvents.map((e) => e.stage)

    expect(stages).toContain("activated")
    expect(stages).toContain("engaged")
    expect(stages).toContain("inactive")
    expect(stageEvents.length).toBe(3)
  })

  test("stage methods without properties send events correctly", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-no-props" })
      window.outlit.user.inactive()
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvent = allEvents.find(
      (e): e is StageEvent => e.type === "stage" && (e as StageEvent).stage === "inactive",
    )

    expect(stageEvent).toBeDefined()
    expect(stageEvent?.type).toBe("stage")
    expect(stageEvent?.stage).toBe("inactive")
  })
})
