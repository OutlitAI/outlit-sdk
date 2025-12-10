/**
 * SPA Navigation Tests
 *
 * Tests that the SDK correctly tracks pageviews during single-page app navigation:
 * - history.pushState
 * - history.replaceState
 * - popstate (browser back/forward)
 */

import { type Route, expect, test } from "@playwright/test"

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

test.describe("SPA Navigation Tracking", () => {
  test("tracks pageview on history.pushState", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Simulate SPA navigation via pushState
    await page.evaluate(() => {
      history.pushState({}, "", "/new-page")
    })

    // Wait for the event to be captured
    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should have at least 2 pageviews: initial + pushState
    expect(pageviews.length).toBeGreaterThanOrEqual(2)

    // Second pageview should have the new path
    const newPageview = pageviews.find((p) => p.path === "/new-page")
    expect(newPageview).toBeDefined()
  })

  test("tracks pageview on history.replaceState", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Simulate SPA navigation via replaceState
    await page.evaluate(() => {
      history.replaceState({}, "", "/replaced-page")
    })

    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should have pageview for replaced URL
    const replacedPageview = pageviews.find((p) => p.path === "/replaced-page")
    expect(replacedPageview).toBeDefined()
  })

  test("tracks pageview on browser back/forward (popstate)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Navigate forward via pushState
    await page.evaluate(() => {
      history.pushState({}, "", "/page-2")
    })
    await page.waitForTimeout(100)

    await page.evaluate(() => {
      history.pushState({}, "", "/page-3")
    })
    await page.waitForTimeout(100)

    // Now go back (triggers popstate)
    await page.goBack()
    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should have pageviews for: initial, page-2, page-3, and back to page-2
    expect(pageviews.length).toBeGreaterThanOrEqual(4)
  })

  test("does not duplicate pageview for same URL", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Try to trigger the same URL multiple times
    await page.evaluate(() => {
      history.pushState({}, "", "/test-page.html")
      history.pushState({}, "", "/test-page.html")
      history.pushState({}, "", "/test-page.html")
    })

    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should only have 1 pageview for test-page.html (deduped)
    const testPageViews = pageviews.filter((p) => p.path?.includes("test-page.html"))
    expect(testPageViews.length).toBe(1)
  })

  test("tracks multiple different page navigations", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Simulate a typical SPA user journey
    const pages = ["/pricing", "/features", "/about", "/contact", "/signup"]

    for (const pagePath of pages) {
      await page.evaluate((path) => {
        history.pushState({}, "", path)
      }, pagePath)
      await page.waitForTimeout(50)
    }

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const pageviews = allEvents.filter((e) => e.type === "pageview")

    // Should have initial + 5 navigations = 6 pageviews
    expect(pageviews.length).toBe(6)

    // Verify each page was tracked
    for (const pagePath of pages) {
      const found = pageviews.find((p) => p.path === pagePath)
      expect(found).toBeDefined()
    }
  })
})

// Window.outlit type is declared in browser-sdk.spec.ts
