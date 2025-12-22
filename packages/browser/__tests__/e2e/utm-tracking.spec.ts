/**
 * UTM Parameter Tracking Tests
 *
 * Tests that the SDK correctly extracts and includes UTM parameters in events:
 * - utm_source
 * - utm_medium
 * - utm_campaign
 * - utm_term
 * - utm_content
 */

import { type Route, expect, test } from "@playwright/test"

interface UtmParams {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
}

interface ApiCall {
  url: string
  payload: {
    visitorId?: string
    source?: string
    events?: Array<{
      type: string
      eventName?: string
      path?: string
      url?: string
      utm?: UtmParams
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

test.describe("UTM Parameter Tracking", () => {
  test("captures all UTM parameters from URL", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Navigate with full UTM parameters
    await page.goto(
      "/test-page.html?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_term=running+shoes&utm_content=banner_a",
    )
    await page.waitForFunction(() => window.outlit?._initialized)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageview = allEvents.find((e) => e.type === "pageview")

    expect(pageview).toBeDefined()
    expect(pageview?.utm).toBeDefined()
    expect(pageview?.utm?.source).toBe("google")
    expect(pageview?.utm?.medium).toBe("cpc")
    expect(pageview?.utm?.campaign).toBe("summer_sale")
    expect(pageview?.utm?.term).toBe("running shoes") // URL decoded
    expect(pageview?.utm?.content).toBe("banner_a")
  })

  test("captures partial UTM parameters", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Only source and medium
    await page.goto("/test-page.html?utm_source=newsletter&utm_medium=email")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageview = allEvents.find((e) => e.type === "pageview")

    expect(pageview?.utm?.source).toBe("newsletter")
    expect(pageview?.utm?.medium).toBe("email")
    expect(pageview?.utm?.campaign).toBeUndefined()
    expect(pageview?.utm?.term).toBeUndefined()
    expect(pageview?.utm?.content).toBeUndefined()
  })

  test("handles URL without UTM parameters", async ({ page }) => {
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
    // UTM should be undefined or empty when no params present
    expect(pageview?.utm).toBeUndefined()
  })

  test("UTM parameters persist to custom events", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html?utm_source=facebook&utm_campaign=retargeting")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Track a custom event
    await page.evaluate(() => {
      window.outlit.track("button_clicked", { buttonId: "cta" })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const customEvent = allEvents.find((e) => e.type === "custom")

    expect(customEvent).toBeDefined()
    expect(customEvent?.utm?.source).toBe("facebook")
    expect(customEvent?.utm?.campaign).toBe("retargeting")
  })

  test("UTM parameters on identify events", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html?utm_source=linkedin&utm_medium=social")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Identify a user
    await page.evaluate(() => {
      window.outlit.identify({ email: "test@example.com" })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.utm?.source).toBe("linkedin")
    expect(identifyEvent?.utm?.medium).toBe("social")
  })

  test("handles special characters in UTM parameters", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // URL encoded special characters
    await page.goto(
      "/test-page.html?utm_source=google&utm_campaign=50%25+off+sale&utm_content=hero%26banner",
    )
    await page.waitForFunction(() => window.outlit?._initialized)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageview = allEvents.find((e) => e.type === "pageview")

    expect(pageview?.utm?.campaign).toBe("50% off sale")
    expect(pageview?.utm?.content).toBe("hero&banner")
  })

  test("UTM parameters updated on SPA navigation", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Start with one set of UTM params
    await page.goto("/test-page.html?utm_source=google")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Navigate to a new URL with different UTM params
    await page.evaluate(() => {
      history.pushState({}, "", "/pricing?utm_source=facebook&utm_campaign=new_campaign")
    })
    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // First pageview should have google
    const firstPageview = pageviews.find((p) => p.path?.includes("test-page"))
    expect(firstPageview?.utm?.source).toBe("google")

    // Second pageview should have facebook
    const secondPageview = pageviews.find((p) => p.path === "/pricing")
    expect(secondPageview?.utm?.source).toBe("facebook")
    expect(secondPageview?.utm?.campaign).toBe("new_campaign")
  })
})

// Window.outlit type is declared in global.d.ts
