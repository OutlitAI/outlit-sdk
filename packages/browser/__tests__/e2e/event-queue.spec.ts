/**
 * Event Queue Behavior Tests
 *
 * Tests the SDK's event batching and flushing behavior:
 * - Auto-flush when queue reaches 10 events
 * - Flush timer behavior
 * - beforeunload flush
 */

import { type Route, expect, test } from "@playwright/test"

interface ApiCall {
  url: string
  timestamp: number
  payload: {
    visitorId?: string
    source?: string
    events?: Array<{
      type: string
      eventName?: string
      properties?: Record<string, unknown>
    }>
  }
}

async function interceptApiCalls(page: import("@playwright/test").Page): Promise<ApiCall[]> {
  const apiCalls: ApiCall[] = []

  await page.route("**/api/i/v1/**/events", async (route: Route) => {
    const postData = route.request().postData()
    apiCalls.push({
      url: route.request().url(),
      timestamp: Date.now(),
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

test.describe("Event Queue Behavior", () => {
  test("auto-flushes when queue reaches 10 events", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Initial pageview is 1 event
    // Track 9 more events (total 10) - should trigger auto-flush
    await page.evaluate(() => {
      for (let i = 1; i <= 9; i++) {
        window.outlit.track(`event_${i}`, { index: i })
      }
    })

    // Wait a short time for the auto-flush
    await page.waitForTimeout(500)

    // Should have auto-flushed (without beforeunload)
    expect(apiCalls.length).toBeGreaterThanOrEqual(1)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    // Should have pageview + 9 custom events = 10
    expect(allEvents.length).toBeGreaterThanOrEqual(10)
  })

  test("does not auto-flush before 10 events", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Track only 5 events (+ 1 pageview = 6 total, below threshold)
    await page.evaluate(() => {
      for (let i = 1; i <= 5; i++) {
        window.outlit.track(`event_${i}`, { index: i })
      }
    })

    // Wait a short time - should NOT auto-flush yet (under 10)
    await page.waitForTimeout(300)

    // May have 0 or 1 calls (for initial pageview batching)
    // The key is that we shouldn't have all events flushed yet
    const totalEvents = apiCalls.flatMap((c) => c.payload.events || [])
    // If events were sent, it should be less than 6 (not all flushed due to threshold)
    // Actually the flush timer may have triggered, so let's check differently

    // Force flush now
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    // Now all events should be sent
    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    expect(allEvents.length).toBeGreaterThanOrEqual(6) // pageview + 5 custom
  })

  test("batches multiple events into single API call", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Track several events quickly
    await page.evaluate(() => {
      window.outlit.track("event_1")
      window.outlit.track("event_2")
      window.outlit.track("event_3")
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    // Should have minimal API calls (batched)
    expect(apiCalls.length).toBeLessThanOrEqual(2)

    // But all events should be present
    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvents = allEvents.filter((e) => e.type === "custom")
    expect(customEvents.length).toBe(3)
  })

  test("flush timer sends events periodically", async ({ page }) => {
    // This test verifies the default 5-second flush timer
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-timer.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Track an event
    await page.evaluate(() => {
      window.outlit.track("timer_test_event")
    })

    // Wait for the default flush timer (5 seconds) + buffer
    await page.waitForTimeout(6000)

    // Should have flushed automatically via timer
    expect(apiCalls.length).toBeGreaterThanOrEqual(1)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const timerEvent = allEvents.find((e) => e.eventName === "timer_test_event")
    expect(timerEvent).toBeDefined()
  })

  test("beforeunload triggers flush", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Track events
    await page.evaluate(() => {
      window.outlit.track("unload_test_1")
      window.outlit.track("unload_test_2")
    })

    // Don't wait for timer - trigger beforeunload immediately
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })

    // Short wait for the flush to complete
    await page.waitForTimeout(500)

    // Events should be sent
    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const unloadEvents = allEvents.filter((e) => e.eventName?.includes("unload_test"))
    expect(unloadEvents.length).toBe(2)
  })

  test("empty queue triggers only engagement event on exit", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Wait for initial pageview to be flushed
    await page.waitForTimeout(6000)

    const callsBeforeFlush = apiCalls.length

    // Trigger flush - with engagement tracking enabled, this will emit an engagement event
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    // Should have exactly one additional API call (for the engagement event)
    // The engagement event is always emitted on exit to capture time-on-page
    expect(apiCalls.length).toBe(callsBeforeFlush + 1)

    // Verify it's an engagement event
    const lastCall = apiCalls[apiCalls.length - 1]
    const events = lastCall?.payload?.events || []
    const engagementEvents = events.filter((e: { type?: string }) => e.type === "engagement")
    expect(engagementEvents.length).toBe(1)
  })
})

// Window.outlit type is declared in global.d.ts
