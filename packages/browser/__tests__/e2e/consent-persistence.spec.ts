import { type Request, type Route, expect, test } from "@playwright/test"

interface ApiCall {
  url: string
  payload: {
    visitorId?: string
    source?: string
    events?: Array<{
      type: string
      eventName?: string
    }>
  }
}

async function interceptApiCalls(page: import("@playwright/test").Page): Promise<ApiCall[]> {
  const apiCalls: ApiCall[] = []

  await page.route("**/api/i/v1/**/events", async (route: Route) => {
    const request: Request = route.request()
    const postData = request.postData()

    apiCalls.push({
      url: request.url(),
      payload: postData ? JSON.parse(postData) : {},
    })

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, processed: 1 }),
    })
  })

  return apiCalls
}

test.describe("Consent Persistence", () => {
  test.beforeEach(async ({ context }) => {
    // Clear all storage before each test
    await context.clearCookies()
  })

  test("persisted consent survives page reload — accept then reload", async ({ page }) => {
    // First visit: accept cookies
    await page.goto("/test-page-consent-persistence.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Initially tracking is disabled
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(false)

    // Accept cookies
    await page.click("#accept-cookies")
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)

    // Reload the page
    await page.reload()
    await page.waitForFunction(() => window.outlit?._initialized)

    // Tracking should be automatically enabled (consent was persisted)
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)
  })

  test("persisted denial survives page reload — reject then reload", async ({ page }) => {
    // First visit: reject cookies
    await page.goto("/test-page-consent-persistence.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Reject cookies (calls disableTracking)
    await page.click("#reject-cookies")
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(false)

    // Reload
    await page.reload()
    await page.waitForFunction(() => window.outlit?._initialized)

    // Tracking should still be disabled
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(false)
  })

  test("revoking consent persists — accept then revoke then reload", async ({ page }) => {
    // First visit: accept then revoke
    await page.goto("/test-page-consent-persistence.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Accept
    await page.click("#accept-cookies")
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)

    // Revoke
    await page.click("#revoke-consent")
    // Wait for async disableTracking to complete
    await page.waitForFunction(() => !window.outlit.isTrackingEnabled())

    // Reload
    await page.reload()
    await page.waitForFunction(() => window.outlit?._initialized)

    // Tracking should be disabled (revocation persisted)
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(false)
  })

  test("re-accepting after revocation persists — full cycle", async ({ page }) => {
    await page.goto("/test-page-consent-persistence.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Accept
    await page.click("#accept-cookies")
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)

    // Revoke
    await page.click("#revoke-consent")
    await page.waitForFunction(() => !window.outlit.isTrackingEnabled())

    // Re-accept
    await page.click("#accept-cookies")
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)

    // Reload
    await page.reload()
    await page.waitForFunction(() => window.outlit?._initialized)

    // Should be enabled (re-acceptance persisted)
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)
  })
})
