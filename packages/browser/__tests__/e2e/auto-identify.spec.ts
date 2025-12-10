/**
 * Auto-Identify Tests
 *
 * Tests automatic user identification when forms are submitted with email fields.
 * Features tested:
 * - Email detection by field name, type="email", and email-like values
 * - Name extraction (full name, first name, last name)
 * - Configuration options (autoIdentify: true/false)
 * - Form event still emitted alongside identify
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

// ============================================
// EMAIL DETECTION TESTS
// ============================================

test.describe("Auto-Identify: Email Detection", () => {
  test("auto-identifies when form has email field by name", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-only.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit the form
    await page.click('#newsletter-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("newsletter@example.com")
  })

  test("auto-identifies when form has type=email input", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Fill the form (it has type="email" input)
    await page.fill('input[name="email"]', "typed@example.com")

    // Prevent navigation
    await page.evaluate(() => {
      document.getElementById("test-form")?.addEventListener("submit", (e) => {
        e.preventDefault()
      })
    })

    // Submit
    await page.click('#test-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("typed@example.com")
  })

  test("auto-identifies from email-like value in generic field", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Fill a non-email field with an email value
    await page.fill('input[name="company"]', "fallback@company.com")
    // Clear the actual email field
    await page.fill('input[name="email"]', "")

    // Prevent navigation
    await page.evaluate(() => {
      document.getElementById("test-form")?.addEventListener("submit", (e) => {
        e.preventDefault()
      })
    })

    // Submit
    await page.click('#test-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("fallback@company.com")
  })

  test("does NOT auto-identify when no email present", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-no-email.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit the form (no email field)
    await page.click('#feedback-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")
    const formEvent = allEvents.find((e) => e.type === "form")

    // Should NOT have identify event
    expect(identifyEvent).toBeUndefined()

    // Should still have form event
    expect(formEvent).toBeDefined()
    expect(formEvent?.formId).toBe("feedback-form")
  })

  test("validates email format (rejects invalid emails)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-only.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Fill with invalid email
    await page.fill('input[name="email"]', "not-an-email")

    // Submit
    await page.click('#newsletter-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    // Should NOT identify with invalid email
    expect(identifyEvent).toBeUndefined()
  })
})

// ============================================
// NAME DETECTION TESTS
// ============================================

test.describe("Auto-Identify: Name Detection", () => {
  test("extracts full name from name field", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-name.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit the form
    await page.click('#demo-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("demo@example.com")
    expect(identifyEvent?.traits?.name).toBe("John Doe")
  })

  test("extracts and combines first_name + last_name", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-first-last.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit the form
    await page.click('#contact-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("contact@example.com")
    expect(identifyEvent?.traits?.name).toBe("Jane Smith")
    expect(identifyEvent?.traits?.firstName).toBe("Jane")
    expect(identifyEvent?.traits?.lastName).toBe("Smith")
  })

  test("handles only first name present", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-first-last.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Clear last name
    await page.fill('input[name="last_name"]', "")

    // Submit the form
    await page.click('#contact-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("contact@example.com")
    expect(identifyEvent?.traits?.firstName).toBe("Jane")
    expect(identifyEvent?.traits?.lastName).toBeUndefined()
    expect(identifyEvent?.traits?.name).toBeUndefined()
  })

  test("handles only last name present", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-first-last.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Clear first name
    await page.fill('input[name="first_name"]', "")

    // Submit the form
    await page.click('#contact-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("contact@example.com")
    expect(identifyEvent?.traits?.lastName).toBe("Smith")
    expect(identifyEvent?.traits?.firstName).toBeUndefined()
    expect(identifyEvent?.traits?.name).toBeUndefined()
  })

  test("handles various name field patterns (fname, firstname)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Add fields with different naming patterns
    await page.evaluate(() => {
      const form = document.getElementById("test-form")
      const fnameInput = document.createElement("input")
      fnameInput.name = "fname"
      fnameInput.value = "Robert"
      form?.insertBefore(fnameInput, form.querySelector('button[type="submit"]'))

      const lnameInput = document.createElement("input")
      lnameInput.name = "surname"
      lnameInput.value = "Johnson"
      form?.insertBefore(lnameInput, form.querySelector('button[type="submit"]'))
    })

    // Fill email
    await page.fill('input[name="email"]', "patterns@example.com")

    // Prevent navigation
    await page.evaluate(() => {
      document.getElementById("test-form")?.addEventListener("submit", (e) => {
        e.preventDefault()
      })
    })

    // Submit
    await page.click('#test-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("patterns@example.com")
    expect(identifyEvent?.traits?.name).toBe("Robert Johnson")
    expect(identifyEvent?.traits?.firstName).toBe("Robert")
    expect(identifyEvent?.traits?.lastName).toBe("Johnson")
  })
})

// ============================================
// INTEGRATION TESTS
// ============================================

test.describe("Auto-Identify: Integration", () => {
  test("form event still emitted alongside identify", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-name.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit the form
    await page.click('#demo-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")
    const formEvent = allEvents.find((e) => e.type === "form")

    // Both should be present
    expect(identifyEvent).toBeDefined()
    expect(formEvent).toBeDefined()

    // Form event should have the form data
    expect(formEvent?.formId).toBe("demo-form")
    expect(formEvent?.formFields?.email).toBe("demo@example.com")
    expect(formEvent?.formFields?.name).toBe("John Doe")
  })

  test("works with newsletter signup form (just email)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-only.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit
    await page.click('#newsletter-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("newsletter@example.com")
    // No traits when only email
    expect(identifyEvent?.traits).toBeUndefined()
  })

  test("works with demo request form (email + name)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-name.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit
    await page.click('#demo-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("demo@example.com")
    expect(identifyEvent?.traits?.name).toBe("John Doe")
  })

  test("works with contact form (email + first + last name)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-email-first-last.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit
    await page.click('#contact-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    expect(identifyEvent).toBeDefined()
    expect(identifyEvent?.email).toBe("contact@example.com")
    expect(identifyEvent?.traits?.name).toBe("Jane Smith")
    expect(identifyEvent?.traits?.firstName).toBe("Jane")
    expect(identifyEvent?.traits?.lastName).toBe("Smith")
  })
})

// ============================================
// CONFIGURATION TESTS
// ============================================

test.describe("Auto-Identify: Configuration", () => {
  test("autoIdentify: false disables auto-identification", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-auto-identify-disabled.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Submit the form
    await page.click('#signup-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")
    const formEvent = allEvents.find((e) => e.type === "form")

    // Should NOT have identify event
    expect(identifyEvent).toBeUndefined()

    // Should still have form event
    expect(formEvent).toBeDefined()
    expect(formEvent?.formId).toBe("signup-form")
  })

  test("data-auto-identify=false disables via script tag", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/form-auto-identify-disabled.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    // Verify the form has email
    const emailValue = await page.inputValue('input[name="email"]')
    expect(emailValue).toBe("disabled@example.com")

    // Submit
    await page.click('#signup-form button[type="submit"]')

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const identifyEvent = allEvents.find((e) => e.type === "identify")

    // Should NOT auto-identify because autoIdentify=false
    expect(identifyEvent).toBeUndefined()
  })
})

// Window.outlit type is declared in browser-sdk.spec.ts
