import { expect, test } from "@playwright/test"

// ============================================
// TYPES
// ============================================

interface ApiCall {
  url: string
  payload: {
    visitorId?: string
    events?: Array<{
      type: string
      activeTimeMs?: number
      totalTimeMs?: number
      sessionId?: string
      path?: string
      url?: string
      timestamp?: number
      eventName?: string
    }>
  }
}

interface EngagementEvent {
  type: "engagement"
  activeTimeMs: number
  totalTimeMs: number
  sessionId: string
  path: string
  url: string
  timestamp: number
}

// ============================================
// HELPERS
// ============================================

async function interceptApiCalls(page: import("@playwright/test").Page): Promise<ApiCall[]> {
  const apiCalls: ApiCall[] = []

  await page.route("**/api/i/v1/**/events", async (route) => {
    const request = route.request()
    const postData = request.postData()
    if (postData) {
      try {
        apiCalls.push({
          url: request.url(),
          payload: JSON.parse(postData),
        })
      } catch {
        // ignore parse errors
      }
    }
    await route.fulfill({ status: 200, body: JSON.stringify({ success: true, processed: 1 }) })
  })

  return apiCalls
}

function getEngagementEvents(apiCalls: ApiCall[]): EngagementEvent[] {
  return apiCalls.flatMap(
    (call) =>
      (call.payload.events?.filter((e) => e.type === "engagement") as EngagementEvent[]) || [],
  )
}

// ============================================
// BASIC ENGAGEMENT EVENT TESTS
// ============================================

test.describe("Session Tracking - Basic", () => {
  test("emits engagement event on page exit via visibilitychange", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    // Simulate tab hidden (most reliable exit event)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Should have at least one engagement event
    expect(engagementEvents.length).toBeGreaterThanOrEqual(1)
    expect(engagementEvents[0]?.type).toBe("engagement")
    expect(typeof engagementEvents[0]?.activeTimeMs).toBe("number")
    expect(typeof engagementEvents[0]?.totalTimeMs).toBe("number")
    expect(typeof engagementEvents[0]?.sessionId).toBe("string")
  })

  test("engagement event has correct time values", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Ensure page is visible (headless browsers may start with hidden state)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    // Wait for 2 seconds of active time
    await page.waitForTimeout(2000)

    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)
    expect(engagementEvents.length).toBeGreaterThanOrEqual(1)

    const engagement = engagementEvents[0]

    // Active time should be around 2 seconds (with some tolerance)
    expect(engagement?.activeTimeMs).toBeGreaterThan(1500)
    expect(engagement?.activeTimeMs).toBeLessThan(3500)

    // Total time should also be around 2 seconds
    expect(engagement?.totalTimeMs).toBeGreaterThan(1500)
    expect(engagement?.totalTimeMs).toBeLessThan(3500)
  })

  test("emits engagement event on beforeunload", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)
    expect(engagementEvents.length).toBeGreaterThanOrEqual(1)
  })
})

// ============================================
// SPA NAVIGATION TESTS
// ============================================

test.describe("Session Tracking - SPA Navigation", () => {
  test("emits engagement event for previous page on SPA navigation", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    // Navigate to new page via pushState (SPA navigation)
    await page.evaluate(() => {
      history.pushState({}, "", "/new-page")
    })
    await page.waitForTimeout(500)

    // Trigger flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Should have engagement events (at least one for the initial page)
    expect(engagementEvents.length).toBeGreaterThanOrEqual(1)
  })

  test("engagement event path matches OLD page, not new page, during SPA navigation", async ({
    page,
  }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Ensure page is visible
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    // Navigate to new page via pushState (SPA navigation)
    // This should emit engagement for /test-page.html, NOT /new-page
    await page.evaluate(() => {
      history.pushState({}, "", "/new-page")
    })
    await page.waitForTimeout(300)

    // Trigger flush to send any queued events (without triggering exit behavior)
    // Note: We can't use beforeunload/visibilitychange as those trigger exit handlers
    // Instead, we wait for the flush interval or check the queue directly
    await page.evaluate(() => {
      // Access the instance and flush manually (cast to any for internal API access)
      window.outlit?._instance?.flush()
    })
    await page.waitForTimeout(300)

    // Get engagement events after flush (should have engagement for old page)
    const engagementAfterNavigation = getEngagementEvents(apiCalls)

    // There should be exactly 1 engagement event at this point (for the OLD page)
    expect(engagementAfterNavigation.length).toBe(1)

    // The engagement event should have the OLD page path
    expect(engagementAfterNavigation[0]?.path).toBe("/test-page.html")
    expect(engagementAfterNavigation[0]?.url).toContain("/test-page.html")

    // It should NOT have the new page path
    expect(engagementAfterNavigation[0]?.path).not.toBe("/new-page")
  })

  test("no spurious engagement event for new page immediately after navigation", async ({
    page,
  }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Ensure page is visible
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    // Navigate to new page via pushState
    await page.evaluate(() => {
      history.pushState({}, "", "/new-page")
    })
    await page.waitForTimeout(300)

    // Trigger flush to send any queued events
    await page.evaluate(() => {
      window.outlit?._instance?.flush()
    })
    await page.waitForTimeout(300)

    // Get all engagement events so far
    const engagementEvents = getEngagementEvents(apiCalls)

    // There should be ONLY engagement for old page, not for new page
    const newPageEngagements = engagementEvents.filter((e) => e.path === "/new-page")
    expect(newPageEngagements.length).toBe(0)

    // Only old page engagement should exist
    const oldPageEngagements = engagementEvents.filter((e) => e.path === "/test-page.html")
    expect(oldPageEngagements.length).toBe(1)
  })

  test("engagement for new page only emits on exit", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Ensure page is visible
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    // Navigate to new page
    await page.evaluate(() => {
      history.pushState({}, "", "/new-page")
    })
    await page.waitForTimeout(300)

    // Flush events after navigation (without triggering exit)
    await page.evaluate(() => {
      window.outlit?._instance?.flush()
    })
    await page.waitForTimeout(300)

    // Count engagements before exit - should only have old page
    const engagementsBeforeExit = getEngagementEvents(apiCalls)
    expect(engagementsBeforeExit.length).toBe(1) // Only old page engagement
    expect(engagementsBeforeExit[0]?.path).toBe("/test-page.html")

    // Now trigger exit (this will emit engagement for new page AND flush)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)

    // After exit, should have engagement for new page too
    const engagementsAfterExit = getEngagementEvents(apiCalls)
    expect(engagementsAfterExit.length).toBe(2)

    // Verify the paths are correct
    const paths = engagementsAfterExit.map((e) => e.path)
    expect(paths).toContain("/test-page.html")
    expect(paths).toContain("/new-page")
  })

  /**
   * This test simulates the Framer/SPA scenario where visibility changes
   * happen during page transitions, which can cause spurious engagement events.
   */
  test("no spurious engagement when visibility toggles during SPA navigation (Framer-like)", async ({
    page,
  }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Ensure page is visible
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    // Simulate Framer-like navigation:
    // 1. Navigate to new page via pushState
    // 2. Immediately after, visibility briefly toggles (Framer animation/transition)
    await page.evaluate(() => {
      // Step 1: SPA navigation
      history.pushState({}, "", "/new-page")

      // Step 2: Framer-like visibility toggle during page transition
      // This simulates what might happen during animated page transitions
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))

      // Step 3: Visibility restored after transition
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)

    // Flush events
    await page.evaluate(() => {
      window.outlit?._instance?.flush()
    })
    await page.waitForTimeout(300)

    const engagementEvents = getEngagementEvents(apiCalls)

    // We should have AT MOST 1 engagement event (for the old page /test-page.html)
    // There should NOT be an engagement for /new-page since we haven't truly "exited" it
    const newPageEngagements = engagementEvents.filter((e) => e.path === "/new-page")

    // BUG CHECK: If this fails, we have the spurious engagement issue
    expect(newPageEngagements.length).toBe(0)

    // Old page engagement should exist
    const oldPageEngagements = engagementEvents.filter((e) => e.path === "/test-page.html")
    expect(oldPageEngagements.length).toBeGreaterThanOrEqual(1)
  })

  /**
   * This test simulates a scenario with delays between visibility changes.
   * In real Framer pages, there might be actual time gaps between events.
   */
  test("no spurious engagement with delayed visibility toggle after SPA navigation", async ({
    page,
  }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Ensure page is visible
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    // Step 1: Navigate to new page
    await page.evaluate(() => {
      history.pushState({}, "", "/new-page")
    })
    await page.waitForTimeout(100)

    // Step 2: Simulate tab briefly going hidden (e.g., Framer transition overlay)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(100)

    // Step 3: Tab becomes visible again
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)

    // Flush events
    await page.evaluate(() => {
      window.outlit?._instance?.flush()
    })
    await page.waitForTimeout(300)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Check for spurious new page engagement
    const newPageEngagements = engagementEvents.filter((e) => e.path === "/new-page")

    // BUG CHECK: If this fails, the visibility toggle is causing spurious engagement
    expect(newPageEngagements.length).toBe(0)
  })

  test("emits engagement events for each page in multi-page journey", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    // Navigate to page 2
    await page.evaluate(() => {
      history.pushState({}, "", "/page-2")
    })
    await page.waitForTimeout(500)

    // Navigate to page 3
    await page.evaluate(() => {
      history.pushState({}, "", "/page-3")
    })
    await page.waitForTimeout(500)

    // Exit
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Should have at least 2 engagement events (initial page + at least one navigation)
    expect(engagementEvents.length).toBeGreaterThanOrEqual(2)
  })
})

// ============================================
// VISIBILITY TRACKING TESTS
// ============================================

test.describe("Session Tracking - Visibility", () => {
  test("pauses time accumulation when tab is hidden", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Ensure page is visible (headless browsers may start with hidden state)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    // Active for 500ms
    await page.waitForTimeout(500)

    // Hide tab
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)
    expect(engagementEvents.length).toBeGreaterThanOrEqual(1)

    const engagement = engagementEvents[0]

    // Active time should be around 500ms (not including hidden time)
    expect(engagement?.activeTimeMs).toBeLessThan(1000)
  })

  test("resumes tracking when tab becomes visible again", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Ensure page is visible (headless browsers may start with hidden state)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    // Active for 500ms
    await page.waitForTimeout(500)

    // Hide tab
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    // Show tab
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    // Active for another 500ms
    await page.waitForTimeout(500)

    // Hide again to get second engagement
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Should have 2 engagement events (one for each visible session)
    expect(engagementEvents.length).toBeGreaterThanOrEqual(2)
  })
})

// ============================================
// EXIT EVENT DEDUPLICATION TESTS
// ============================================

test.describe("Session Tracking - Deduplication", () => {
  test("does not duplicate engagement events from multiple exit handlers", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    // Fire multiple exit events rapidly
    await page.evaluate(() => {
      // These should all be deduplicated
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("pagehide"))
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Should only have 1 engagement event despite 3 exit events
    expect(engagementEvents.length).toBe(1)
  })

  test("allows new engagement after returning to tab", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    // Count engagement events before first exit
    const eventsBefore = getEngagementEvents(apiCalls).length

    // First exit
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)

    const eventsAfterFirstExit = getEngagementEvents(apiCalls).length
    expect(eventsAfterFirstExit).toBe(eventsBefore + 1) // Should have 1 new engagement

    // Return to tab (resets the hasHandledExit flag)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    // Second exit (should emit new engagement)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Should have 2 more engagement events than before (one per exit)
    expect(engagementEvents.length).toBe(eventsAfterFirstExit + 1)
  })
})

// ============================================
// ENGAGEMENT EVENT SHAPE TESTS
// ============================================

test.describe("Session Tracking - Event Shape", () => {
  test("engagement event has all required fields including sessionId", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)
    expect(engagementEvents.length).toBeGreaterThanOrEqual(1)

    const engagement = engagementEvents[0]

    // Required fields
    expect(engagement?.type).toBe("engagement")
    expect(typeof engagement?.activeTimeMs).toBe("number")
    expect(typeof engagement?.totalTimeMs).toBe("number")
    expect(typeof engagement?.sessionId).toBe("string")
    expect(typeof engagement?.path).toBe("string")
    expect(typeof engagement?.url).toBe("string")
    expect(typeof engagement?.timestamp).toBe("number")

    // Validate sessionId is a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(engagement?.sessionId).toMatch(uuidRegex)

    // Validate timestamp is recent
    const now = Date.now()
    expect(engagement?.timestamp).toBeGreaterThan(now - 60000)
    expect(engagement?.timestamp).toBeLessThanOrEqual(now + 1000)
  })

  test("activeTimeMs is less than or equal to totalTimeMs", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Ensure page is visible (headless browsers may start with hidden state)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    await page.waitForTimeout(1500)

    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)
    expect(engagementEvents.length).toBeGreaterThanOrEqual(1)

    const engagement = engagementEvents[0]
    expect(engagement?.activeTimeMs).toBeLessThanOrEqual(engagement?.totalTimeMs ?? 0)
  })
})

// ============================================
// SESSION ID TESTS
// ============================================

test.describe("Session Tracking - Session ID", () => {
  test("sessionId is consistent across multiple engagement events in same session", async ({
    page,
  }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    // Navigate to trigger first engagement
    await page.evaluate(() => {
      history.pushState({}, "", "/page-2")
    })
    await page.waitForTimeout(500)

    // Navigate again to trigger second engagement
    await page.evaluate(() => {
      history.pushState({}, "", "/page-3")
    })
    await page.waitForTimeout(500)

    // Final exit
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Should have at least 2 engagement events
    expect(engagementEvents.length).toBeGreaterThanOrEqual(2)

    // All engagement events should have the same sessionId
    const sessionIds = engagementEvents.map((e) => e.sessionId)
    const uniqueSessionIds = [...new Set(sessionIds)]
    expect(uniqueSessionIds.length).toBe(1)
    expect(uniqueSessionIds[0]).toBeDefined()
  })

  test("sessionId is a valid UUID", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const engagementEvents = getEngagementEvents(apiCalls)
    expect(engagementEvents.length).toBeGreaterThanOrEqual(1)

    const sessionId = engagementEvents[0]?.sessionId
    expect(sessionId).toBeDefined()

    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(sessionId).toMatch(uuidRegex)
  })

  test("sessionId persists across page visibility changes within session", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    // First exit (hide tab)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)

    // Return to tab
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(500)

    // Second exit
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Should have 2 engagement events with the same sessionId
    expect(engagementEvents.length).toBe(2)

    const sessionId1 = engagementEvents[0]?.sessionId
    const sessionId2 = engagementEvents[1]?.sessionId

    expect(sessionId1).toBeDefined()
    expect(sessionId2).toBeDefined()
    expect(sessionId1).toBe(sessionId2)
  })

  test("sessionId stored in sessionStorage", async ({ page }) => {
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    // Check that sessionId is stored in sessionStorage
    const sessionId = await page.evaluate(() => {
      return sessionStorage.getItem("outlit_session_id")
    })

    expect(sessionId).toBeDefined()
    expect(sessionId).not.toBeNull()

    // Should be a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(sessionId).toMatch(uuidRegex)
  })

  test("last activity timestamp stored in sessionStorage", async ({ page }) => {
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(500)

    // Check that last activity is stored in sessionStorage
    const lastActivity = await page.evaluate(() => {
      return sessionStorage.getItem("outlit_session_last_activity")
    })

    expect(lastActivity).toBeDefined()
    expect(lastActivity).not.toBeNull()

    // Should be a valid timestamp (recent)
    const timestamp = Number.parseInt(lastActivity as string, 10)
    const now = Date.now()
    expect(timestamp).toBeGreaterThan(now - 60000)
    expect(timestamp).toBeLessThanOrEqual(now + 1000)
  })

  test("sessionId resets after 30 minutes of inactivity when user resumes (simulated)", async ({
    page,
  }) => {
    const apiCalls = await interceptApiCalls(page)

    // Use the session test page with 500ms idle timeout for faster testing
    await page.goto("/test-page-session.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    // Wait at least 600ms to exceed the MIN_PAGE_TIME_FOR_ENGAGEMENT threshold (500ms)
    await page.waitForTimeout(600)

    // Get the initial sessionId
    const initialSessionId = await page.evaluate(() => {
      return sessionStorage.getItem("outlit_session_id")
    })
    expect(initialSessionId).toBeDefined()

    // Emit first engagement event
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)

    // Return to visible
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    // Wait at least 600ms to exceed MIN_PAGE_TIME_FOR_ENGAGEMENT for the second engagement
    await page.waitForTimeout(600)

    // Wait for idle timeout to kick in (500ms in test page)
    // After this, isUserActive will be false
    await page.waitForTimeout(700)

    // Simulate 31 minutes of inactivity by setting last_activity to 31 minutes ago
    await page.evaluate(() => {
      const thirtyOneMinutesMs = 31 * 60 * 1000
      const oldTimestamp = Date.now() - thirtyOneMinutesMs
      sessionStorage.setItem("outlit_session_last_activity", oldTimestamp.toString())
    })

    // Now simulate user activity after being idle
    // This should trigger checkSessionExpiry() and create a new session
    await page.evaluate(() => {
      // Trigger a user activity event - this will call handleActivity()
      // which should check session expiry since user was idle
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
    })
    await page.waitForTimeout(300)

    // Get the new sessionId
    const newSessionId = await page.evaluate(() => {
      return sessionStorage.getItem("outlit_session_id")
    })

    // The sessionId should have changed because 30+ minutes of inactivity passed
    expect(newSessionId).toBeDefined()
    expect(newSessionId).not.toBe(initialSessionId)

    // Wait at least 600ms to exceed the MIN_PAGE_TIME_FOR_ENGAGEMENT threshold (500ms)
    await page.waitForTimeout(600)

    // Emit another engagement event
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)

    const engagementEvents = getEngagementEvents(apiCalls)

    // Should have 2 engagement events with different sessionIds
    expect(engagementEvents.length).toBeGreaterThanOrEqual(2)

    const firstEventSessionId = engagementEvents[0]?.sessionId
    const lastEventSessionId = engagementEvents[engagementEvents.length - 1]?.sessionId

    expect(firstEventSessionId).toBe(initialSessionId)
    expect(lastEventSessionId).toBe(newSessionId)
    expect(firstEventSessionId).not.toBe(lastEventSessionId)
  })

  test("sessionId does NOT reset if activity within 30 minutes (simulated)", async ({ page }) => {
    // Use the session test page with 500ms idle timeout for faster testing
    await page.goto("/test-page-session.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(300)

    // Get the initial sessionId
    const initialSessionId = await page.evaluate(() => {
      return sessionStorage.getItem("outlit_session_id")
    })
    expect(initialSessionId).toBeDefined()

    // Wait for idle timeout (500ms) so user becomes idle
    await page.waitForTimeout(700)

    // Simulate 25 minutes of inactivity (less than 30 minute threshold)
    await page.evaluate(() => {
      const twentyFiveMinutesMs = 25 * 60 * 1000
      const oldTimestamp = Date.now() - twentyFiveMinutesMs
      sessionStorage.setItem("outlit_session_last_activity", oldTimestamp.toString())
    })

    // Trigger user activity - should check session expiry but NOT reset
    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
    })
    await page.waitForTimeout(300)

    // Get the sessionId after activity
    const currentSessionId = await page.evaluate(() => {
      return sessionStorage.getItem("outlit_session_id")
    })

    // SessionId should remain the same since we're within the 30 minute window
    expect(currentSessionId).toBe(initialSessionId)
  })
})
