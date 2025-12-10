/**
 * Advanced Form Tracking Tests
 *
 * Tests edge cases in form capture:
 * - Forms without id/name
 * - File inputs (should be skipped)
 * - Value-based sensitive data detection
 * - Custom field denylist
 */

import { type Route, expect, test } from "@playwright/test"

interface ApiCall {
  url: string
  payload: {
    visitorId?: string
    source?: string
    events?: Array<{
      type: string
      formId?: string
      formFields?: Record<string, string>
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

test.describe("Form Tracking - Edge Cases", () => {
  test("captures form without id or name", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-no-id.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Submit the form
    await page.click('button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvent = allEvents.find((e) => e.type === "form")

    expect(formEvent).toBeDefined()
    // formId should be undefined when form has no id/name
    expect(formEvent?.formId).toBeUndefined()
    expect(formEvent?.formFields?.email).toBe("test@example.com")
  })

  test("excludes file inputs from capture", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-file-inputs.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Submit the form
    await page.click('button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvent = allEvents.find((e) => e.type === "form")

    expect(formEvent).toBeDefined()
    expect(formEvent?.formFields?.email).toBe("test@example.com")
    // File inputs should not be captured
    expect(formEvent?.formFields?.document).toBeUndefined()
    expect(formEvent?.formFields?.resume).toBeUndefined()
  })

  test("filters credit card number in value (not just field name)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-credit-card.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Fill the credit card field
    await page.fill('input[name="custom_field"]', "4111111111111111")

    // Submit the form
    await page.click('button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvent = allEvents.find((e) => e.type === "form")

    expect(formEvent).toBeDefined()
    expect(formEvent?.formFields?.email).toBe("test@example.com")
    expect(formEvent?.formFields?.normal_field).toBe("hello world")
    // Credit card number in value should be filtered
    expect(formEvent?.formFields?.custom_field).toBeUndefined()
  })

  test("filters SSN pattern in value", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-ssn.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Submit the form
    await page.click('button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvent = allEvents.find((e) => e.type === "form")

    expect(formEvent).toBeDefined()
    expect(formEvent?.formFields?.email).toBe("test@example.com")
    // SSN pattern should be filtered
    expect(formEvent?.formFields?.id_number).toBeUndefined()
  })

  test("filters various password field variations", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-password-variations.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Submit the form
    await page.click('button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvent = allEvents.find((e) => e.type === "form")

    expect(formEvent).toBeDefined()
    expect(formEvent?.formFields?.email).toBe("test@example.com")

    // All sensitive fields should be filtered
    expect(formEvent?.formFields?.user_password).toBeUndefined()
    expect(formEvent?.formFields?.passwd).toBeUndefined()
    expect(formEvent?.formFields?.pwd).toBeUndefined()
    expect(formEvent?.formFields?.pass_confirm).toBeUndefined()
    expect(formEvent?.formFields?.api_key).toBeUndefined()
    expect(formEvent?.formFields?.secret_token).toBeUndefined()
  })

  test("handles form with only sensitive fields gracefully", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-all-sensitive.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Submit the form
    await page.click('button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    // Form event should NOT be sent if all fields are filtered
    const formEvent = allEvents.find((e) => e.type === "form")
    expect(formEvent).toBeUndefined()
  })

  test("captures multiple form submissions on same page", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-multiple.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Submit both forms
    await page.click('#form-1 button[type="submit"]')
    await page.waitForTimeout(100)
    await page.click('#form-2 button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const formEvents = allEvents.filter((e) => e.type === "form")

    expect(formEvents.length).toBe(2)
    expect(formEvents.find((e) => e.formId === "form-1")).toBeDefined()
    expect(formEvents.find((e) => e.formId === "form-2")).toBeDefined()
  })
})

// Window.outlit type is declared in browser-sdk.spec.ts
