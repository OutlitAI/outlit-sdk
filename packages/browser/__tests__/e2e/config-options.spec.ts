/**
 * Configuration Options Tests
 *
 * Tests that SDK configuration options work correctly:
 * - trackPageviews: false - disables automatic pageview tracking
 * - trackForms: false - disables automatic form tracking
 * - formFieldDenylist - custom list of fields to exclude from form capture
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
// TRACK PAGEVIEWS CONFIG TESTS
// ============================================

test.describe("trackPageviews Configuration", () => {
  test("trackPageviews=false disables automatic pageview tracking", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-no-pageviews.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Wait a moment for any events to be captured
    await page.waitForTimeout(500)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should have NO pageview events
    expect(pageviews.length).toBe(0)
  })

  test("custom track() events still work when trackPageviews=false", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-no-pageviews.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Click the track button
    await page.click("#track-btn")

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvents = allEvents.filter((e) => e.type === "custom")
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Custom events should still work
    expect(customEvents.length).toBeGreaterThanOrEqual(1)
    const clickEvent = customEvents.find((e) => e.eventName === "button_clicked")
    expect(clickEvent).toBeDefined()
    expect(clickEvent?.properties?.config).toBe("no-pageviews")

    // But still no pageviews
    expect(pageviews.length).toBe(0)
  })

  test("SPA navigation does not trigger pageviews when trackPageviews=false", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-no-pageviews.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Simulate SPA navigation
    await page.evaluate(() => {
      history.pushState({}, "", "/new-page")
    })
    await page.waitForTimeout(200)

    await page.evaluate(() => {
      history.pushState({}, "", "/another-page")
    })
    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should still have no pageviews
    expect(pageviews.length).toBe(0)
  })
})

// ============================================
// TRACK FORMS CONFIG TESTS
// ============================================

test.describe("trackForms Configuration", () => {
  test("trackForms=false disables automatic form tracking", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-no-forms.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit the form
    await page.click('#test-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvents = allEvents.filter((e) => e.type === "form")

    // Should have NO form events
    expect(formEvents.length).toBe(0)
  })

  test("pageviews still work when trackForms=false", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-no-forms.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should still have pageview
    expect(pageviews.length).toBeGreaterThanOrEqual(1)
  })

  test("custom track() events still work when trackForms=false", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-no-forms.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Click the track button
    await page.click("#track-btn")

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvents = allEvents.filter((e) => e.type === "custom")
    const formEvents = allEvents.filter((e) => e.type === "form")

    // Custom events should work
    expect(customEvents.length).toBeGreaterThanOrEqual(1)
    const clickEvent = customEvents.find((e) => e.eventName === "button_clicked")
    expect(clickEvent).toBeDefined()
    expect(clickEvent?.properties?.config).toBe("no-forms")

    // But no form events
    expect(formEvents.length).toBe(0)
  })

  test("multiple form submissions are not tracked when trackForms=false", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-no-forms.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit form multiple times
    await page.click('#test-form button[type="submit"]')
    await page.waitForTimeout(100)
    await page.click('#test-form button[type="submit"]')
    await page.waitForTimeout(100)
    await page.click('#test-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvents = allEvents.filter((e) => e.type === "form")

    // Should still have no form events
    expect(formEvents.length).toBe(0)
  })
})

// ============================================
// CUSTOM FORM FIELD DENYLIST TESTS
// ============================================

// NOTE: Custom formFieldDenylist is only supported via programmatic initialization,
// not via script tag data attributes. The SDK's autoInit() doesn't parse
// data-form-field-denylist. These tests are skipped until that feature is added.

test.describe("Custom formFieldDenylist Configuration", () => {
  test.skip("custom denylist excludes specified fields from form capture", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-custom-denylist.html")
    await page.waitForFunction(() => window.outlit?._initialized)

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

    // email, name, and company should be captured
    expect(formEvent?.formFields?.email).toBe("test@example.com")
    expect(formEvent?.formFields?.name).toBe("Test User")
    expect(formEvent?.formFields?.company).toBe("Test Corp")

    // phone and internal_id should be excluded by custom denylist
    expect(formEvent?.formFields?.phone).toBeUndefined()
    expect(formEvent?.formFields?.internal_id).toBeUndefined()
  })

  test.skip("default sensitive fields are still excluded with custom denylist", async ({
    page,
  }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page-custom-denylist.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Add a password field dynamically and fill it
    await page.evaluate(() => {
      const form = document.getElementById("test-form")
      const passwordInput = document.createElement("input")
      passwordInput.name = "password"
      passwordInput.type = "password"
      passwordInput.value = "secret123"
      form?.insertBefore(passwordInput, form.querySelector('button[type="submit"]'))
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

    // Custom denylist fields excluded
    expect(formEvent?.formFields?.phone).toBeUndefined()
    expect(formEvent?.formFields?.internal_id).toBeUndefined()

    // Default sensitive field (password) also excluded
    expect(formEvent?.formFields?.password).toBeUndefined()

    // Normal fields captured
    expect(formEvent?.formFields?.email).toBe("test@example.com")
  })
})

// Window.outlit type is declared in browser-sdk.spec.ts
