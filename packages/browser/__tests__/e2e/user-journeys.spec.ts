/**
 * Complex User Journey Tests
 *
 * Tests realistic multi-step user journeys to ensure tracking is robust:
 * - Multi-action flows (land, navigate, click, form submit, identify)
 * - Rapid button interactions
 * - Back navigation with continued interactions
 */

import { type Route, expect, test } from "@playwright/test"

interface FullEvent {
  type: "pageview" | "custom" | "form" | "identify"
  timestamp: number
  url: string
  path: string
  eventName?: string
  properties?: Record<string, unknown>
  formId?: string
  formFields?: Record<string, string>
  email?: string
  userId?: string
  traits?: Record<string, unknown>
}

interface ApiCall {
  url: string
  payload: {
    visitorId?: string
    source?: string
    events?: FullEvent[]
  }
}

async function interceptApiCalls(page: import("@playwright/test").Page): Promise<ApiCall[]> {
  const apiCalls: ApiCall[] = []

  await page.route("**/api/i/v1/**/events", async (route: Route) => {
    const postData = route.request().postData()
    apiCalls.push({
      url: route.request().url(),
      payload: postData ? JSON.parse(postData) : {},
    })
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  })

  return apiCalls
}

// ============================================
// MULTI-ACTION USER FLOW TESTS
// ============================================

test.describe("Multi-Action User Flows", () => {
  test("complete user journey: land -> navigate -> track -> form -> identify", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Step 1: Land on homepage (should trigger pageview)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Step 2: Navigate to a new page via SPA (should trigger pageview)
    await page.evaluate(() => {
      history.pushState({}, "", "/pricing")
    })
    await page.waitForTimeout(100)

    // Step 3: Track a custom event
    await page.evaluate(() => {
      window.outlit.track("viewed_pricing", { plan: "enterprise" })
    })

    // Step 4: Navigate to signup page
    await page.evaluate(() => {
      history.pushState({}, "", "/signup")
    })
    await page.waitForTimeout(100)

    // Step 5: Fill and submit form
    await page.evaluate(() => {
      // Simulate form submission event without actual form
      window.outlit.track("form_started", { formId: "signup-form" })
    })

    // Step 6: Identify the user
    await page.evaluate(() => {
      window.outlit.identify({
        email: "journey@example.com",
        userId: "user_journey_123",
        traits: { source: "pricing_page", plan_interest: "enterprise" },
      })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])

    // Verify all event types are present
    const pageviews = allEvents.filter((e) => e.type === "pageview")
    const customEvents = allEvents.filter((e) => e.type === "custom")
    const identifyEvents = allEvents.filter((e) => e.type === "identify")

    // Should have pageviews for: /test-page.html, /pricing, /signup
    expect(pageviews.length).toBe(3)
    expect(pageviews.find((p) => p.path === "/test-page.html")).toBeDefined()
    expect(pageviews.find((p) => p.path === "/pricing")).toBeDefined()
    expect(pageviews.find((p) => p.path === "/signup")).toBeDefined()

    // Should have custom events
    expect(customEvents.length).toBe(2)
    expect(customEvents.find((e) => e.eventName === "viewed_pricing")).toBeDefined()
    expect(customEvents.find((e) => e.eventName === "form_started")).toBeDefined()

    // Should have identify event
    expect(identifyEvents.length).toBe(1)
    const identifyEvent = identifyEvents[0]
    expect(identifyEvent).toBeDefined()
    expect(identifyEvent!.email).toBe("journey@example.com")
    expect(identifyEvent!.userId).toBe("user_journey_123")

    // Verify events are in chronological order (timestamps increase)
    for (let i = 1; i < allEvents.length; i++) {
      const currentEvent = allEvents[i]
      const previousEvent = allEvents[i - 1]
      expect(currentEvent!.timestamp).toBeGreaterThanOrEqual(previousEvent!.timestamp)
    }
  })

  test("events capture correct path at time of action", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Track event on initial page
    await page.evaluate(() => {
      window.outlit.track("action_on_page_1", { page: "initial" })
    })

    // Navigate
    await page.evaluate(() => {
      history.pushState({}, "", "/page-2")
    })
    await page.waitForTimeout(100)

    // Track event on second page
    await page.evaluate(() => {
      window.outlit.track("action_on_page_2", { page: "second" })
    })

    // Navigate again
    await page.evaluate(() => {
      history.pushState({}, "", "/page-3")
    })
    await page.waitForTimeout(100)

    // Track event on third page
    await page.evaluate(() => {
      window.outlit.track("action_on_page_3", { page: "third" })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvents = allEvents.filter((e) => e.type === "custom")

    // Each custom event should have the correct path for when it was tracked
    const event1 = customEvents.find((e) => e.eventName === "action_on_page_1")
    const event2 = customEvents.find((e) => e.eventName === "action_on_page_2")
    const event3 = customEvents.find((e) => e.eventName === "action_on_page_3")

    expect(event1?.path).toBe("/test-page.html")
    expect(event2?.path).toBe("/page-2")
    expect(event3?.path).toBe("/page-3")
  })
})

// ============================================
// RAPID INTERACTION TESTS
// ============================================

test.describe("Rapid Button Interactions", () => {
  test("rapid button clicks are all captured", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Track 5 events rapidly
    await page.evaluate(() => {
      window.outlit.track("rapid_click_1", { index: 1 })
      window.outlit.track("rapid_click_2", { index: 2 })
      window.outlit.track("rapid_click_3", { index: 3 })
      window.outlit.track("rapid_click_4", { index: 4 })
      window.outlit.track("rapid_click_5", { index: 5 })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const rapidClicks = allEvents.filter((e) => e.eventName?.startsWith("rapid_click_"))

    // All 5 rapid clicks should be captured
    expect(rapidClicks.length).toBe(5)

    // Each click should have correct properties
    for (let i = 1; i <= 5; i++) {
      const click = rapidClicks.find((e) => e.eventName === `rapid_click_${i}`)
      expect(click).toBeDefined()
      expect(click?.properties?.index).toBe(i)
    }
  })

  test("rapid mixed actions are all captured", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Rapidly perform different actions
    await page.evaluate(() => {
      window.outlit.track("action_track", { type: "track" })
      window.outlit.identify({ email: "rapid@example.com", traits: { fast: true } })
      window.outlit.track("action_after_identify", { type: "after-identify" })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])

    // Should have pageview + 2 custom events + 1 identify
    const customEvents = allEvents.filter((e) => e.type === "custom")
    const identifyEvents = allEvents.filter((e) => e.type === "identify")

    expect(customEvents.length).toBe(2)
    expect(identifyEvents.length).toBe(1)
    expect(identifyEvents[0]!.traits?.fast).toBe(true)
  })

  test("high volume events are handled correctly", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Track 20 events rapidly (should trigger auto-flush at 10)
    await page.evaluate(() => {
      for (let i = 1; i <= 20; i++) {
        window.outlit.track(`volume_event_${i}`, { index: i })
      }
    })

    // Wait for auto-flush and final flush
    await page.waitForTimeout(1000)

    // Force flush any remaining
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const volumeEvents = allEvents.filter((e) => e.eventName?.startsWith("volume_event_"))

    // All 20 volume events should be captured
    expect(volumeEvents.length).toBe(20)

    // Verify each one exists with correct index
    for (let i = 1; i <= 20; i++) {
      const event = volumeEvents.find((e) => e.eventName === `volume_event_${i}`)
      expect(event).toBeDefined()
      expect(event?.properties?.index).toBe(i)
    }
  })
})

// ============================================
// BACK NAVIGATION TESTS
// ============================================

test.describe("Back Navigation with Continued Interactions", () => {
  test("back navigation captures correct path for subsequent events", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Navigate: page1 -> page2 -> page3
    await page.evaluate(() => {
      history.pushState({}, "", "/page-2")
    })
    await page.waitForTimeout(100)

    await page.evaluate(() => {
      history.pushState({}, "", "/page-3")
    })
    await page.waitForTimeout(100)

    // Track event on page-3
    await page.evaluate(() => {
      window.outlit.track("on_page_3", { before_back: true })
    })

    // Go back to page-2
    await page.goBack()
    await page.waitForTimeout(200)

    // Track event on page-2 (after going back)
    await page.evaluate(() => {
      window.outlit.track("after_back_to_page_2", { after_back: true })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])

    // Find the events
    const eventOnPage3 = allEvents.find((e) => e.eventName === "on_page_3")
    const eventAfterBack = allEvents.find((e) => e.eventName === "after_back_to_page_2")

    expect(eventOnPage3).toBeDefined()
    expect(eventOnPage3?.path).toBe("/page-3")

    expect(eventAfterBack).toBeDefined()
    expect(eventAfterBack?.path).toBe("/page-2")
  })

  test("forward navigation after back captures correct path", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Navigate forward
    await page.evaluate(() => {
      history.pushState({}, "", "/step-1")
    })
    await page.waitForTimeout(100)

    await page.evaluate(() => {
      history.pushState({}, "", "/step-2")
    })
    await page.waitForTimeout(100)

    // Go back
    await page.goBack()
    await page.waitForTimeout(200)

    // Track event
    await page.evaluate(() => {
      window.outlit.track("at_step_1", {})
    })

    // Go forward
    await page.goForward()
    await page.waitForTimeout(200)

    // Track another event
    await page.evaluate(() => {
      window.outlit.track("back_at_step_2", {})
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])

    const eventAtStep1 = allEvents.find((e) => e.eventName === "at_step_1")
    const eventAtStep2 = allEvents.find((e) => e.eventName === "back_at_step_2")

    expect(eventAtStep1?.path).toBe("/step-1")
    expect(eventAtStep2?.path).toBe("/step-2")
  })

  test("complex back/forward navigation maintains event integrity", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Complex navigation pattern
    // Start: /test-page.html
    await page.evaluate(() => {
      history.pushState({}, "", "/a")
    })
    await page.waitForTimeout(50)

    await page.evaluate(() => {
      history.pushState({}, "", "/b")
    })
    await page.waitForTimeout(50)

    await page.goBack() // Now at /a
    await page.waitForTimeout(100)

    await page.evaluate(() => {
      history.pushState({}, "", "/c") // New branch from /a
    })
    await page.waitForTimeout(50)

    // Track event at /c
    await page.evaluate(() => {
      window.outlit.track("final_position", { path: "c" })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")
    const customEvent = allEvents.find((e) => e.eventName === "final_position")

    // Should have pageviews for: /test-page.html, /a, /b, /a (back), /c
    // Note: Going back to /a triggers a pageview
    expect(pageviews.length).toBeGreaterThanOrEqual(4)

    // Final custom event should be at /c
    expect(customEvent?.path).toBe("/c")
  })
})

// Window.outlit type is declared in global.d.ts
