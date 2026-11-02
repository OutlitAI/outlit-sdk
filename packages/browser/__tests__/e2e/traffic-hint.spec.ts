/**
 * Traffic hint tests
 *
 * Playwright sets navigator.webdriver, so the SDK still sends every event and
 * marks the batch as automation for Outlit to classify.
 */

import { expect, test } from "@playwright/test"

test("sends events from an automated browser with a traffic hint", async ({ page }) => {
  const payloads: Array<{ traffic?: unknown; events?: unknown[] }> = []
  await page.route("**/api/i/v1/**/events", async (route) => {
    payloads.push(JSON.parse(route.request().postData() ?? "{}"))
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  })

  await page.goto("/test-page-simple.html")
  await page.waitForFunction(() => window.outlit?._initialized)
  await page.evaluate(async () => {
    window.outlit.track("pricing_viewed")
    await window.outlit._instance?.flush()
  })

  await expect.poll(() => payloads.length).toBeGreaterThan(0)
  expect(payloads[0]?.traffic).toEqual({
    class: "automation",
    signals: expect.arrayContaining(["webdriver"]),
  })
  expect(payloads.flatMap((p) => p.events ?? []).length).toBeGreaterThan(0)
})
