import { expect, type Request, type Route, test } from "@playwright/test"

interface ApiCall {
  url: string
  payload: {
    visitorId?: string
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
      body: JSON.stringify({ success: true }),
    })
  })

  return apiCalls
}

function bootstrapBody(country: string | null, consentRequired: boolean) {
  return {
    status: 200,
    contentType: "application/json",
    headers: { "cache-control": "private, max-age=3600" },
    body: JSON.stringify({ country, consentRequired }),
  }
}

async function outlitLocalStorageKeys(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("outlit")))
}

test.describe("Auto tracking mode", () => {
  test("enables tracking when the region does not require consent", async ({ page, context }) => {
    const apiCalls = await interceptApiCalls(page)
    const bootstrapResponse = page.waitForResponse("**/api/i/v1/**/bootstrap")
    await page.route("**/api/i/v1/**/bootstrap", async (route: Route) => {
      await route.fulfill(bootstrapBody("US", false))
    })

    await page.goto("/test-page-auto.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await bootstrapResponse

    // Tracking turns on once the edge verdict arrives
    await page.waitForFunction(() => window.outlit.isTrackingEnabled())
    expect(await page.evaluate(() => window.outlit.getVisitorId())).toBeTruthy()

    // Automatic enable persists no consent decision
    expect(await outlitLocalStorageKeys(page)).not.toContain("outlit_consent")
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === "outlit_consent")).toBeUndefined()

    // Events flow normally
    await page.click("#track-btn")
    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)
    const events = apiCalls.flatMap((c) => c.payload.events || [])
    expect(events.some((e) => e.type === "custom" && e.eventName === "button_clicked")).toBe(true)
  })

  test("stays disabled and stores nothing when consent is required", async ({ page, context }) => {
    const apiCalls = await interceptApiCalls(page)
    const bootstrapResponse = page.waitForResponse("**/api/i/v1/**/bootstrap")
    await page.route("**/api/i/v1/**/bootstrap", async (route: Route) => {
      await route.fulfill(bootstrapBody("DE", true))
    })

    await page.goto("/test-page-auto.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await bootstrapResponse
    await page.waitForTimeout(200)

    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(false)
    expect(await page.evaluate(() => window.outlit.getVisitorId())).toBeNull()

    // Zero outlit storage writes
    expect(await outlitLocalStorageKeys(page)).toEqual([])
    const cookies = await context.cookies()
    expect(cookies.filter((c) => c.name.startsWith("outlit"))).toEqual([])

    // track() calls are dropped, not sent
    await page.click("#track-btn")
    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(300)
    expect(apiCalls.length).toBe(0)

    // Explicit consent still works
    await page.click("#enable-btn")
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)
    expect(await page.evaluate(() => localStorage.getItem("outlit_consent"))).toBe("2")
  })

  test("fails closed when the bootstrap request fails", async ({ page }) => {
    await page.route("**/api/i/v1/**/bootstrap", (route: Route) => route.abort("failed"))

    await page.goto("/test-page-auto.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(300)

    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(false)
    expect(await outlitLocalStorageKeys(page)).toEqual([])
  })

  test('data-auto-track="auto" enables tracking when consent is not required', async ({ page }) => {
    const bootstrapResponse = page.waitForResponse("**/api/i/v1/**/bootstrap")
    await page.route("**/api/i/v1/**/bootstrap", async (route: Route) => {
      await route.fulfill(bootstrapBody("US", false))
    })

    await page.goto("/test-page-auto-attr.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await bootstrapResponse

    await page.waitForFunction(() => window.outlit.isTrackingEnabled())
  })

  test("buffers calls made while pending and sends them after enable", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Hold the bootstrap response until we trigger a track() during the pending window
    const pendingRoutes: Route[] = []
    await page.route("**/api/i/v1/**/bootstrap", (route: Route) => {
      pendingRoutes.push(route)
    })

    await page.goto("/test-page-auto.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await expect.poll(() => pendingRoutes.length).toBe(1)

    // Tracking still off, but the call is buffered (not dropped)
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(false)
    await page.click("#track-btn")

    await pendingRoutes[0]!.fulfill(bootstrapBody("US", false))
    await page.waitForFunction(() => window.outlit.isTrackingEnabled())

    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(500)

    const events = apiCalls.flatMap((c) => c.payload.events || [])
    expect(events.some((e) => e.type === "custom" && e.eventName === "button_clicked")).toBe(true)
  })

  test("persisted opt-out skips the bootstrap request entirely", async ({ page }) => {
    let bootstrapRequests = 0
    await page.route("**/api/i/v1/**/bootstrap", async (route: Route) => {
      bootstrapRequests++
      await route.fulfill(bootstrapBody("US", false))
    })
    await page.addInitScript(() => {
      localStorage.setItem("outlit_consent", "0")
    })

    await page.goto("/test-page-auto.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await page.waitForTimeout(300)

    expect(bootstrapRequests).toBe(0)
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(false)
  })

  test("explicit enableTracking during the pending window wins", async ({ page }) => {
    const pendingRoutes: Route[] = []
    await page.route("**/api/i/v1/**/bootstrap", (route: Route) => {
      pendingRoutes.push(route)
    })

    await page.goto("/test-page-auto.html")
    await page.waitForFunction(() => window.outlit?._initialized)
    await expect.poll(() => pendingRoutes.length).toBe(1)

    await page.click("#enable-btn")
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)

    // A late "consent required" verdict must not override the explicit decision
    await pendingRoutes[0]!.fulfill(bootstrapBody("DE", true))
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.outlit.isTrackingEnabled())).toBe(true)
  })
})
