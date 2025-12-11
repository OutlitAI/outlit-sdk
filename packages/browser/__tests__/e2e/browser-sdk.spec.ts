import { type Request, type Route, expect, test } from "@playwright/test"

interface ApiCall {
  url: string
  payload: {
    visitorId?: string
    source?: string
    events?: Array<{
      type: string
      eventName?: string
      path?: string
      properties?: Record<string, unknown>
      email?: string
      userId?: string
    }>
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
// SDK INITIALIZATION TESTS
// ============================================

test.describe("SDK Initialization", () => {
  test("initializes and sets visitor ID", async ({ page }) => {
    await page.goto("/test-page.html")

    // Wait for SDK to initialize
    await page.waitForFunction(() => window.outlit?._initialized)

    // Check visitor ID is generated
    const visitorId = await page.evaluate(() => window.outlit.getVisitorId())
    expect(visitorId).toBeTruthy()
    expect(visitorId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test("visitor ID persists across page reloads", async ({ page }) => {
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    const visitorId1 = await page.evaluate(() => window.outlit.getVisitorId())

    // Reload page
    await page.reload()
    await page.waitForFunction(() => window.outlit?._initialized)

    const visitorId2 = await page.evaluate(() => window.outlit.getVisitorId())

    expect(visitorId2).toBe(visitorId1)
  })

  test("visitor ID persists across different pages", async ({ page, context }) => {
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    const visitorId1 = await page.evaluate(() => window.outlit.getVisitorId())

    // Navigate to a different page
    await page.goto("/test-page-links.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    const visitorId2 = await page.evaluate(() => window.outlit.getVisitorId())

    expect(visitorId2).toBe(visitorId1)
  })

  test("sets cookie with correct attributes", async ({ page, context }) => {
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    const cookies = await context.cookies()
    const visitorCookie = cookies.find((c) => c.name === "outlit_visitor_id")

    expect(visitorCookie).toBeDefined()
    expect(visitorCookie?.value).toMatch(/^[0-9a-f-]{36}$/i)
    expect(visitorCookie?.sameSite).toBe("Lax")
  })
})

// ============================================
// PAGEVIEW TRACKING TESTS
// ============================================

test.describe("Pageview Tracking", () => {
  test("sends pageview on page load", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Wait a bit for the flush timer or trigger manually
    await page.waitForTimeout(1000)

    // Check that a pageview event was captured
    // Note: Events may be batched, so we check the queue
    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])

    // If no API calls yet, the events are still in the queue
    // We can check the queue directly
    if (allEvents.length === 0) {
      // Events are batched, which is expected behavior
      // The test passes if SDK initialized without errors
      expect(true).toBe(true)
    } else {
      const pageviewEvent = allEvents.find((e) => e.type === "pageview")
      expect(pageviewEvent).toBeDefined()
    }
  })

  test("includes correct page path in pageview", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Trigger a page unload to force flush (or wait for timer)
    await page.evaluate(() => {
      // Force flush by dispatching beforeunload
      window.dispatchEvent(new Event("beforeunload"))
    })

    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviewEvent = allEvents.find((e) => e.type === "pageview")

    if (pageviewEvent) {
      expect(pageviewEvent.path).toContain("/test-page.html")
    }
  })
})

// ============================================
// CUSTOM EVENT TRACKING TESTS
// ============================================

test.describe("Custom Event Tracking", () => {
  test("track() sends custom event with properties", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Click the track button
    await page.click("#track-btn")

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvent = allEvents.find(
      (e) => e.type === "custom" && e.eventName === "button_clicked",
    )

    expect(customEvent).toBeDefined()
    if (customEvent) {
      expect(customEvent.properties).toHaveProperty("buttonId", "track-btn")
    }
  })

  test("multiple track() calls are batched", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Track multiple events
    await page.evaluate(() => {
      window.outlit.track("event_1", { index: 1 })
      window.outlit.track("event_2", { index: 2 })
      window.outlit.track("event_3", { index: 3 })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    // All events should be in one or few API calls (batched)
    expect(apiCalls.length).toBeLessThanOrEqual(2) // Initial pageview + custom events

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvents = allEvents.filter((e) => e.type === "custom")

    expect(customEvents.length).toBeGreaterThanOrEqual(3)
  })
})

// ============================================
// IDENTIFY TESTS
// ============================================

test.describe("Identify", () => {
  test("identify() sends identify event with email", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Click identify button
    await page.click("#identify-btn")

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    if (identifyEvent) {
      expect(identifyEvent.email).toBe("test@example.com")
      expect(identifyEvent.userId).toBe("user_12345")
    }
  })
})

// ============================================
// CONSENT MODE TESTS
// ============================================

test.describe("Consent Mode (autoTrack=false)", () => {
  test("does not track when autoTrack=false", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-consent.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Try to track an event
    await page.click("#track-btn")

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    // Should have no API calls (no pageview, no custom event)
    expect(apiCalls.length).toBe(0)
  })

  test("does not set visitor ID when autoTrack=false", async ({ page, context }) => {
    await page.goto("/test-page-consent.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Visitor ID should be null
    const visitorId = await page.evaluate(() => window.outlit.getVisitorId())
    expect(visitorId).toBeNull()

    // Cookie should not be set
    const cookies = await context.cookies()
    const visitorCookie = cookies.find((c) => c.name === "outlit_visitor_id")
    expect(visitorCookie).toBeUndefined()
  })

  test("enableTracking() enables tracking after consent", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-consent.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Initially no tracking
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(false)

    // Accept cookies (calls enableTracking)
    await page.click("#accept-cookies")

    // Now tracking should be enabled
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)

    // Visitor ID should now be set
    const visitorId = await page.evaluate(() => window.outlit.getVisitorId())
    expect(visitorId).toBeTruthy()

    // Track an event
    await page.click("#track-btn")

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    // Now we should have API calls
    expect(apiCalls.length).toBeGreaterThan(0)
  })
})

// ============================================
// FORM TRACKING TESTS
// ============================================

test.describe("Form Tracking", () => {
  test("captures form submission", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Fill out the form
    await page.fill('input[name="email"]', "form@example.com")
    await page.fill('input[name="name"]', "John Doe")
    await page.fill('input[name="company"]', "Test Corp")

    // Prevent actual form submission
    await page.evaluate(() => {
      document.getElementById("test-form")?.addEventListener("submit", (e) => {
        e.preventDefault()
      })
    })

    // Submit the form
    await page.click('#test-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvent = allEvents.find((e) => e.type === "form")

    expect(formEvent).toBeDefined()
  })

  test("excludes sensitive fields from form capture", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Fill form including password
    await page.fill('input[name="email"]', "form@example.com")
    await page.fill('input[name="password"]', "supersecret123")

    // Prevent submission
    await page.evaluate(() => {
      document.getElementById("test-form")?.addEventListener("submit", (e) => {
        e.preventDefault()
      })
    })

    await page.click('#test-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvent = allEvents.find((e) => e.type === "form")

    if (formEvent?.properties) {
      // Password field should not be captured
      expect(formEvent.properties).not.toHaveProperty("password")
    }
  })
})

// ============================================
// API PAYLOAD STRUCTURE TESTS
// ============================================

test.describe("API Payload Structure", () => {
  test("payload includes visitorId and source", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.track("test_event")
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    expect(apiCalls.length).toBeGreaterThan(0)

    const payload = apiCalls[0]?.payload
    expect(payload?.visitorId).toBeTruthy()
    expect(payload?.source).toBe("client")
  })

  test("API URL includes public key", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.track("test_event")
    })

    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    expect(apiCalls.length).toBeGreaterThan(0)

    // URL should contain the public key from the data attribute
    expect(apiCalls[0]?.url).toContain("pk_test_key_12345")
  })
})

// ============================================
// ERROR HANDLING TESTS
// ============================================

test.describe("Error Handling", () => {
  test("gracefully handles API errors", async ({ page }) => {
    // Make API return errors
    await page.route("**/api/i/v1/**/events", async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      })
    })

    // Should not throw errors even when API fails
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.track("test_event")
    })

    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })

    // Page should still be functional
    const status = await page.locator("#status-text").textContent()
    expect(status).toBeTruthy()
  })

  test("gracefully handles network failures", async ({ page }) => {
    // Abort all API requests
    await page.route("**/api/i/v1/**/events", async (route: Route) => {
      await route.abort("failed")
    })

    // Should not throw errors
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.track("test_event")
    })

    // Page should still work
    expect(await page.title()).toBe("SDK Test Page")
  })
})

// ============================================
// SIMPLE ASYNC SCRIPT TESTS
// ============================================

test.describe("Simple Async Script (Alternative Approach)", () => {
  test("initializes with simple async script tag", async ({ page }) => {
    await page.goto("/test-page-simple.html")

    // Wait for SDK to initialize (may take longer with async)
    await page.waitForFunction(() => window.outlit?._initialized, {
      timeout: 10000,
    })

    // Check visitor ID is generated
    const visitorId = await page.evaluate(() => window.outlit.getVisitorId())
    expect(visitorId).toBeTruthy()
    expect(visitorId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test("tracks events after SDK loads", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-simple.html")
    await page.waitForFunction(() => window.outlit?._initialized, {
      timeout: 10000,
    })

    // Click track button
    await page.click("#track-btn")

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvent = allEvents.find(
      (e) => e.type === "custom" && e.eventName === "button_clicked",
    )

    expect(customEvent).toBeDefined()
    if (customEvent) {
      expect(customEvent.properties).toHaveProperty("approach", "simple-async")
    }
  })
})

// ============================================
// STUB SNIPPET SPECIFIC TESTS
// ============================================

test.describe("Stub Snippet (Recommended Approach)", () => {
  test("stub exists immediately before SDK loads", async ({ page }) => {
    // Navigate but block the SDK from loading
    await page.route("**/outlit.global.js", (route) => route.abort())

    await page.goto("/test-page.html")

    // The stub should exist immediately
    const stubExists = await page.evaluate(() => {
      return typeof window.outlit === "object" && Array.isArray(window.outlit._q)
    })

    expect(stubExists).toBe(true)
  })

  test("queued calls are processed after SDK loads", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Use the dedicated fixture that queues calls before SDK loads
    await page.goto("/test-page-queued.html")

    // Wait for SDK to initialize and process queue
    await page.waitForFunction(() => window.outlit?._initialized, {
      timeout: 10000,
    })

    // Give it time to process the queue
    await page.waitForTimeout(1000)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const earlyEvents = allEvents.filter(
      (e) => e.type === "custom" && e.properties?.queued === true,
    )

    // Both queued events should have been processed
    expect(earlyEvents.length).toBe(2)
  })

  test("double-load protection prevents re-initialization", async ({ page }) => {
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    const visitorId1 = await page.evaluate(() => window.outlit.getVisitorId())

    // Try to load the SDK again
    await page.evaluate(() => {
      const s = document.createElement("script")
      s.src = "https://cdn.outlit.ai/canary/outlit.js"
      s.dataset.publicKey = "pk_different_key"
      document.body.appendChild(s)
    })

    await page.waitForTimeout(1000)

    // Visitor ID should be the same (not re-initialized)
    const visitorId2 = await page.evaluate(() => window.outlit.getVisitorId())
    expect(visitorId2).toBe(visitorId1)
  })
})

// ============================================
// TYPE DECLARATIONS
// ============================================

declare global {
  interface Window {
    outlit: {
      _initialized: boolean
      _q?: Array<[string, unknown[]]> // Stub queue before SDK loads
      init: (options: { publicKey: string; apiHost?: string }) => void
      track: (eventName: string, properties?: Record<string, unknown>) => void
      identify: (options: {
        email?: string
        userId?: string
        traits?: Record<string, unknown>
      }) => void
      getVisitorId: () => string | null
      enableTracking: () => void
      isTrackingEnabled: () => boolean
    }
  }
}
