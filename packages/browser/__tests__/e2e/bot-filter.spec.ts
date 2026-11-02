/**
 * Bot filter tests
 *
 * The project config hides navigator.webdriver so fixtures behave like real
 * visitors; these tests restore it to simulate Playwright/Puppeteer/Selenium.
 */

import { expect, type Page, test } from "@playwright/test"

async function countEventRequests(page: Page): Promise<() => number> {
  let count = 0
  await page.route("**/api/i/v1/**/events", async (route) => {
    count++
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  })
  return () => count
}

async function simulateAutomation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "webdriver", { get: () => true })
  })
}

async function trackAndFlush(page: Page): Promise<void> {
  await page.waitForFunction(() => window.outlit?._initialized)
  await page.evaluate(async () => {
    window.outlit.track("pricing_viewed")
    await window.outlit._instance?.flush()
  })
}

test("sends events from a regular browser", async ({ page }) => {
  const eventRequests = await countEventRequests(page)

  await page.goto("/test-page-simple.html")
  await trackAndFlush(page)

  await expect.poll(eventRequests).toBeGreaterThan(0)
})

test("drops events from an automated browser by default", async ({ page }) => {
  const eventRequests = await countEventRequests(page)
  await simulateAutomation(page)

  await page.goto("/test-page-simple.html")
  await trackAndFlush(page)
  await page.waitForTimeout(500)

  expect(eventRequests()).toBe(0)
})

test('data-bot-filter="false" sends events from an automated browser', async ({ page }) => {
  const eventRequests = await countEventRequests(page)
  await simulateAutomation(page)

  await page.goto("/test-page-bot-filter-off.html")
  await trackAndFlush(page)

  await expect.poll(eventRequests).toBeGreaterThan(0)
})
