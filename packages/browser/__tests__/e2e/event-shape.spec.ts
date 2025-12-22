/**
 * Event Shape Validation Tests
 *
 * Validates that all event types have the correct structure with all required fields:
 * - timestamp (valid Unix milliseconds)
 * - url (full URL with protocol)
 * - path (extracted pathname)
 * - referrer (when applicable)
 * - type-specific fields (title, eventName, properties, formId, formFields, email, userId, traits)
 */

import { type Route, expect, test } from "@playwright/test"

interface FullEvent {
  type: "pageview" | "custom" | "form" | "identify"
  timestamp: number
  url: string
  path: string
  referrer?: string
  utm?: {
    source?: string
    medium?: string
    campaign?: string
    term?: string
    content?: string
  }
  // Pageview specific
  title?: string
  // Custom event specific
  eventName?: string
  properties?: Record<string, unknown>
  // Form specific
  formId?: string
  formFields?: Record<string, string>
  // Identify specific
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

function assertValidTimestamp(timestamp: number): void {
  const now = Date.now()
  // Timestamp should be within the last minute and not in the future
  expect(timestamp).toBeGreaterThan(now - 60000)
  expect(timestamp).toBeLessThanOrEqual(now + 1000)
}

// ============================================
// PAGEVIEW EVENT SHAPE TESTS
// ============================================

test.describe("Pageview Event Shape", () => {
  test("pageview event has all required fields", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageview = allEvents.find((e) => e.type === "pageview")

    expect(pageview).toBeDefined()

    // Validate type
    expect(pageview?.type).toBe("pageview")

    // Validate timestamp
    expect(typeof pageview?.timestamp).toBe("number")
    assertValidTimestamp(pageview!.timestamp)

    // Validate url (full URL with protocol)
    expect(pageview?.url).toBeDefined()
    expect(pageview?.url).toContain("http")
    expect(pageview?.url).toContain("localhost")
    expect(pageview?.url).toContain("/test-page.html")

    // Validate path
    expect(pageview?.path).toBe("/test-page.html")

    // Validate title matches document title
    expect(pageview?.title).toBe("SDK Test Page")
  })

  test("pageview captures referrer when present", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Navigate with a referrer header
    await page.goto("/test-page.html", {
      referer: "https://google.com/search?q=test",
    })
    await page.waitForFunction(() => window.outlit?._initialized)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageview = allEvents.find((e) => e.type === "pageview")

    expect(pageview).toBeDefined()
    expect(pageview?.referrer).toBe("https://google.com/search?q=test")
  })

  test("pageview has undefined referrer for direct traffic", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Navigate without referrer (direct traffic)
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageview = allEvents.find((e) => e.type === "pageview")

    expect(pageview).toBeDefined()
    // Referrer should be empty string or undefined for direct traffic
    expect(pageview?.referrer === "" || pageview?.referrer === undefined).toBe(true)
  })

  test("SPA navigation captures correct title after async title update", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Load initial page
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Simulate SPA navigation: pushState first, then update title asynchronously
    // This mimics how React/Next.js/Framer update titles AFTER navigation
    // Real frameworks typically update within 5ms, but we use a small delay
    // to simulate the async nature of SPA title updates
    await page.evaluate(() => {
      // Navigate to new URL
      history.pushState({}, "", "/about")
      // Update title asynchronously (like SPAs do - usually within a few ms)
      setTimeout(() => {
        document.title = "About Page"
      }, 5)
    })

    // Wait for the delayed pageview capture to complete (SDK waits 10ms)
    await page.waitForTimeout(100)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should have 2 pageviews: initial + SPA navigation
    expect(pageviews.length).toBe(2)

    // First pageview should be initial page
    expect(pageviews[0]?.path).toBe("/test-page.html")
    expect(pageviews[0]?.title).toBe("SDK Test Page")

    // Second pageview should have the NEW title, not the old one
    expect(pageviews[1]?.path).toBe("/about")
    expect(pageviews[1]?.title).toBe("About Page")
  })

  test("SPA navigation does NOT capture stale title from previous page", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Simulate multiple rapid SPA navigations (like clicking through a site quickly)
    // Each navigation updates the title within 5ms (simulating real SPA behavior)
    // The SDK waits 10ms before capturing, so titles should be correct
    await page.evaluate(() => {
      // First navigation
      history.pushState({}, "", "/terms")
      setTimeout(() => {
        document.title = "Terms of Service"
      }, 5)

      // Second navigation after first one has time to complete (50ms gap)
      setTimeout(() => {
        history.pushState({}, "", "/privacy")
        setTimeout(() => {
          document.title = "Privacy Policy"
        }, 5)
      }, 50)
    })

    // Wait for all navigations to complete (50ms + 10ms SDK delay + buffer)
    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should have 3 pageviews
    expect(pageviews.length).toBe(3)

    // Verify each pageview has the CORRECT title for its path
    const termsPageview = pageviews.find((p) => p.path === "/terms")
    const privacyPageview = pageviews.find((p) => p.path === "/privacy")

    expect(termsPageview?.title).toBe("Terms of Service")
    expect(privacyPageview?.title).toBe("Privacy Policy")
  })
})

// ============================================
// CUSTOM EVENT SHAPE TESTS
// ============================================

test.describe("Custom Event Shape", () => {
  test("custom event has all required fields", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Track a custom event
    await page.evaluate(() => {
      window.outlit.track("test_event", { key: "value" })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvent = allEvents.find((e) => e.type === "custom" && e.eventName === "test_event")

    expect(customEvent).toBeDefined()

    // Validate type
    expect(customEvent?.type).toBe("custom")

    // Validate timestamp
    expect(typeof customEvent?.timestamp).toBe("number")
    assertValidTimestamp(customEvent!.timestamp)

    // Validate url
    expect(customEvent?.url).toContain("http")
    expect(customEvent?.url).toContain("/test-page.html")

    // Validate path
    expect(customEvent?.path).toBe("/test-page.html")

    // Validate eventName
    expect(customEvent?.eventName).toBe("test_event")

    // Validate properties
    expect(customEvent?.properties).toEqual({ key: "value" })
  })

  test("custom event supports boolean property values", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.track("boolean_test", { active: true, disabled: false })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvent = allEvents.find((e) => e.eventName === "boolean_test")

    expect(customEvent).toBeDefined()
    expect(customEvent?.properties?.active).toBe(true)
    expect(customEvent?.properties?.disabled).toBe(false)
  })

  test("custom event supports null property values", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.track("null_test", { value: null, name: "test" })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvent = allEvents.find((e) => e.eventName === "null_test")

    expect(customEvent).toBeDefined()
    expect(customEvent?.properties?.value).toBeNull()
    expect(customEvent?.properties?.name).toBe("test")
  })

  test("custom event supports empty properties object", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.track("empty_props_test", {})
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvent = allEvents.find((e) => e.eventName === "empty_props_test")

    expect(customEvent).toBeDefined()
    expect(customEvent?.properties).toEqual({})
  })

  test("custom event supports undefined properties", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.track("no_props_test")
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvent = allEvents.find((e) => e.eventName === "no_props_test")

    expect(customEvent).toBeDefined()
    // Properties should be undefined when not provided
    expect(customEvent?.properties).toBeUndefined()
  })

  test("custom event supports mixed property types", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.track("mixed_types", {
        stringValue: "hello",
        numberValue: 42,
        booleanValue: true,
        nullValue: null,
      })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvent = allEvents.find((e) => e.eventName === "mixed_types")

    expect(customEvent).toBeDefined()
    expect(customEvent?.properties?.stringValue).toBe("hello")
    expect(customEvent?.properties?.numberValue).toBe(42)
    expect(customEvent?.properties?.booleanValue).toBe(true)
    expect(customEvent?.properties?.nullValue).toBeNull()
  })
})

// ============================================
// IDENTIFY EVENT SHAPE TESTS
// ============================================

test.describe("Identify Event Shape", () => {
  test("identify event has all required fields including traits", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Click the identify button which sends traits
    await page.click("#identify-btn")

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()

    // Validate type
    expect(identifyEvent?.type).toBe("identify")

    // Validate timestamp
    expect(typeof identifyEvent?.timestamp).toBe("number")
    assertValidTimestamp(identifyEvent!.timestamp)

    // Validate url
    expect(identifyEvent?.url).toContain("http")
    expect(identifyEvent?.url).toContain("/test-page.html")

    // Validate path
    expect(identifyEvent?.path).toBe("/test-page.html")

    // Validate email and userId
    expect(identifyEvent?.email).toBe("test@example.com")
    expect(identifyEvent?.userId).toBe("user_12345")

    // CRITICAL: Validate traits are present and correct
    expect(identifyEvent?.traits).toBeDefined()
    expect(identifyEvent?.traits?.plan).toBe("pro")
    expect(identifyEvent?.traits?.company).toBe("Test Corp")
  })

  test("identify event supports various trait types", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    await page.evaluate(() => {
      window.outlit.identify({
        email: "traits@example.com",
        traits: {
          name: "John Doe",
          age: 30,
          isPremium: true,
          referralCode: null,
        },
      })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find(
      (e) => e.type === "identify" && e.email === "traits@example.com",
    )

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.traits?.name).toBe("John Doe")
    expect(identifyEvent?.traits?.age).toBe(30)
    expect(identifyEvent?.traits?.isPremium).toBe(true)
    expect(identifyEvent?.traits?.referralCode).toBeNull()
  })
})

// ============================================
// FORM EVENT SHAPE TESTS
// ============================================

test.describe("Form Event Shape", () => {
  test("form event has all required fields", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Fill and submit the form
    await page.fill('input[name="email"]', "form@example.com")
    await page.fill('input[name="name"]', "Jane Doe")
    await page.fill('input[name="company"]', "Acme Inc")

    // Prevent actual form submission
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

    expect(formEvent).toBeDefined()

    // Validate type
    expect(formEvent?.type).toBe("form")

    // Validate timestamp
    expect(typeof formEvent?.timestamp).toBe("number")
    assertValidTimestamp(formEvent!.timestamp)

    // Validate url
    expect(formEvent?.url).toContain("http")
    expect(formEvent?.url).toContain("/test-page.html")

    // Validate path
    expect(formEvent?.path).toBe("/test-page.html")

    // Validate formId
    expect(formEvent?.formId).toBe("test-form")

    // Validate formFields (password should be excluded)
    expect(formEvent?.formFields).toBeDefined()
    expect(formEvent?.formFields?.email).toBe("form@example.com")
    expect(formEvent?.formFields?.name).toBe("Jane Doe")
    expect(formEvent?.formFields?.company).toBe("Acme Inc")
    expect(formEvent?.formFields?.password).toBeUndefined()
  })
})

// Window.outlit type is declared in global.d.ts
