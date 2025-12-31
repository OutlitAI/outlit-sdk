/**
 * Stage Methods E2E Tests
 *
 * Tests the stage tracking methods (activate, engaged, paid, churned)
 * to ensure they correctly send stage events to the API.
 */

import { type Request, type Route, expect, test } from "@playwright/test"

interface StageEvent {
  type: "stage"
  stage: string
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
  test("churned() sends stage event with properties", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-123" })
      window.outlit.churned({ reason: "cancelled", plan: "pro" })
    })

    // Force flush
    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvent = allEvents.find(
      (e): e is StageEvent => e.type === "stage" && (e as StageEvent).stage === "churned",
    )

    expect(stageEvent).toBeDefined()
    expect(stageEvent?.type).toBe("stage")
    expect(stageEvent?.stage).toBe("churned")
    expect(stageEvent?.properties?.reason).toBe("cancelled")
    expect(stageEvent?.properties?.plan).toBe("pro")
  })

  test("churned() requires user identity (logs warning)", async ({ page }) => {
    const warnings: string[] = []

    // Set up console listener before navigation
    page.on("console", (msg) => {
      if (msg.type() === "warning") warnings.push(msg.text())
    })

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Call churned without setting user identity
    await page.evaluate(() => {
      window.outlit.churned({ reason: "test" })
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
      window.outlit.activate({ milestone: "onboarding_complete" })
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
      window.outlit.engaged({ sessions: 10 })
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

  test("paid() sends stage event", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-paid" })
      window.outlit.paid({ plan: "enterprise", mrr: 999 })
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvent = allEvents.find(
      (e): e is StageEvent => e.type === "stage" && (e as StageEvent).stage === "paid",
    )

    expect(stageEvent).toBeDefined()
    expect(stageEvent?.type).toBe("stage")
    expect(stageEvent?.stage).toBe("paid")
    expect(stageEvent?.properties?.plan).toBe("enterprise")
    expect(stageEvent?.properties?.mrr).toBe(999)
  })

  test("all stage methods work in sequence: activate, engaged, paid, churned", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-lifecycle" })
      window.outlit.activate()
      window.outlit.engaged()
      window.outlit.paid()
      window.outlit.churned()
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvents = allEvents.filter((e): e is StageEvent => e.type === "stage")
    const stages = stageEvents.map((e) => e.stage)

    expect(stages).toContain("activated")
    expect(stages).toContain("engaged")
    expect(stages).toContain("paid")
    expect(stages).toContain("churned")
    expect(stageEvents.length).toBe(4)
  })

  test("stage methods without properties send events correctly", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.setUser({ userId: "user-no-props" })
      window.outlit.churned()
    })

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const stageEvent = allEvents.find(
      (e): e is StageEvent => e.type === "stage" && (e as StageEvent).stage === "churned",
    )

    expect(stageEvent).toBeDefined()
    expect(stageEvent?.type).toBe("stage")
    expect(stageEvent?.stage).toBe("churned")
  })
})
