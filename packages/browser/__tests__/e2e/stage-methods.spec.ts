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
    events?: Array<StageEvent | BillingEvent | Record<string, unknown>>
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

  test("inactive() queues event when user identity not set (no warning)", async ({ page }) => {
    const warnings: string[] = []

    // Set up console listener before navigation
    page.on("console", (msg) => {
      if (msg.type() === "warning") warnings.push(msg.text())
    })

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Call inactive without setting user identity - should queue silently
    await page.evaluate(() => {
      window.outlit.user.inactive({ reason: "test" })
    })

    // Wait a bit to ensure no warning is logged
    await page.waitForTimeout(100)

    // Should NOT log a warning when queuing (only when queue is full)
    expect(warnings.some((w) => w.includes("setUser") || w.includes("identify"))).toBe(false)
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
      window.outlit.customer.trialing({
        domain: "test.outlit.ai",
        customerId: "cust_123",
        properties: { plan: "pro" },
      })
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
    expect(billingEvent?.domain).toBe("test.outlit.ai")
    expect(billingEvent?.customerId).toBe("cust_123")
    expect(billingEvent?.properties?.plan).toBe("pro")
  })

  test("churned() sends billing event with stripeCustomerId", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.customer.churned({
        domain: "test.outlit.ai",
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
    expect(billingEvent?.domain).toBe("test.outlit.ai")
    expect(billingEvent?.stripeCustomerId).toBe("cus_stripe_abc")
    expect(billingEvent?.properties?.reason).toBe("cancelled")
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

// ============================================
// PENDING STAGE EVENTS TESTS
// ============================================

test.describe("Pending Stage Events", () => {
  test("stage events queued when user not set, flushed on setUser()", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Call stage method BEFORE setting user identity
    await page.evaluate(() => {
      window.outlit.user.activate({ milestone: "onboarding_complete" })
    })

    // Verify no events sent yet (no flush triggered)
    await page.waitForTimeout(100)
    let allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvents = allEvents.filter((e): e is StageEvent => e.type === "stage")
    expect(stageEvents.length).toBe(0)

    // Now set user identity - should flush pending events
    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-delayed" })
    })

    // Force flush
    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const activateEvent = allEvents.find(
      (e): e is StageEvent => e.type === "stage" && (e as StageEvent).stage === "activated",
    )

    expect(activateEvent).toBeDefined()
    expect(activateEvent?.properties?.milestone).toBe("onboarding_complete")
  })

  test("stage events queued when user not set, flushed on identify()", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Call stage method BEFORE identifying
    await page.evaluate(() => {
      window.outlit.user.engaged({ sessions: 5 })
    })

    // Now identify - should flush pending events
    await page.evaluate(() => {
      window.outlit.identify({ email: "test@example.com" })
    })

    // Force flush
    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const engagedEvent = allEvents.find(
      (e): e is StageEvent => e.type === "stage" && (e as StageEvent).stage === "engaged",
    )

    expect(engagedEvent).toBeDefined()
    expect(engagedEvent?.properties?.sessions).toBe(5)
  })

  test("queue limit warning when exceeding MAX_PENDING_STAGE_EVENTS", async ({ page }) => {
    const warnings: string[] = []

    page.on("console", (msg) => {
      if (msg.type() === "warning") warnings.push(msg.text())
    })

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Queue 11 events (limit is 10)
    await page.evaluate(() => {
      for (let i = 0; i < 11; i++) {
        window.outlit.user.activate({ attempt: i })
      }
    })

    await page.waitForTimeout(100)

    expect(warnings.some((w) => w.includes("queue full") || w.includes("10"))).toBe(true)
  })

  test("pending events cleared on clearUser()", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Queue a stage event
    await page.evaluate(() => {
      window.outlit.user.activate({ milestone: "should_be_cleared" })
    })

    // Clear user (simulating logout) - should clear pending events
    await page.evaluate(() => {
      window.outlit.clearUser()
    })

    // Set a new user
    await page.evaluate(() => {
      window.outlit.setUser({ userId: "new-user" })
    })

    // Force flush
    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const activateEvent = allEvents.find(
      (e): e is StageEvent =>
        e.type === "stage" &&
        (e as StageEvent).stage === "activated" &&
        (e as StageEvent).properties?.milestone === "should_be_cleared",
    )

    // The event should NOT be present (it was cleared)
    expect(activateEvent).toBeUndefined()
  })

  test("multiple pending events preserve order and properties when flushed", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Queue multiple events before setting user
    await page.evaluate(() => {
      window.outlit.user.activate({ step: 1 })
      window.outlit.user.engaged({ step: 2 })
      window.outlit.user.inactive({ step: 3 })
    })

    // Set user to flush
    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-multi" })
    })

    // Force flush
    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvents = allEvents.filter((e): e is StageEvent => e.type === "stage")

    expect(stageEvents.length).toBe(3)

    const activateEvent = stageEvents.find((e) => e.stage === "activated")
    const engagedEvent = stageEvents.find((e) => e.stage === "engaged")
    const inactiveEvent = stageEvents.find((e) => e.stage === "inactive")

    expect(activateEvent?.properties?.step).toBe(1)
    expect(engagedEvent?.properties?.step).toBe(2)
    expect(inactiveEvent?.properties?.step).toBe(3)
  })
})
