/**
 * Real Cal.com Booking E2E Test
 *
 * This test interacts with a REAL Cal.com embed and makes an actual booking.
 * It verifies that the Outlit SDK correctly captures the booking event.
 *
 * ⚠️  WARNING: This test creates REAL bookings on Cal.com!
 *
 * To run:
 *   pnpm test -- calendar-embed-real.spec.ts --headed
 *
 * To exclude from CI:
 *   pnpm test -- --grep-invert "Real Cal.com"
 *
 * Uses: https://cal.com/leo-paz/15min (simple form: name + email only)
 */

import { type FrameLocator, type Page, type Route, expect, test } from "@playwright/test"

interface FullEvent {
  type: "pageview" | "custom" | "form" | "identify" | "calendar"
  timestamp: number
  url: string
  path: string
  provider?: "cal.com" | "calendly" | "unknown"
  eventType?: string
  startTime?: string
  endTime?: string
  duration?: number
  isRecurring?: boolean
  inviteeName?: string
  inviteeEmail?: string
}

interface ApiCall {
  url: string
  payload: {
    visitorId?: string
    source?: string
    events?: FullEvent[]
  }
}

async function interceptApiCalls(page: Page): Promise<ApiCall[]> {
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

/**
 * Select the first available time slot.
 * Cal.com auto-selects an available day, so we just need to click a time.
 */
async function selectFirstAvailableTimeSlot(calFrame: FrameLocator, page: Page): Promise<void> {
  await calFrame.locator("main").waitFor({ state: "visible", timeout: 30000 })

  // Time slots are buttons like "11:30am", "1:00pm" etc.
  const timeSlots = calFrame.locator("button").filter({
    hasText: /^\d{1,2}:\d{2}(am|pm)$/i,
  })

  // Wait for time slots to appear
  await timeSlots.first().waitFor({ state: "visible", timeout: 15000 })

  const count = await timeSlots.count()
  console.log(`Found ${count} time slots`)

  await timeSlots.first().click()
  console.log("✅ Selected time slot")
}

/**
 * Fill the simple booking form (name + email only).
 * Labels: "Your name", "Email address", "Additional notes"
 */
async function fillSimpleBookingForm(
  calFrame: FrameLocator,
  page: Page,
  data: { name: string; email: string },
): Promise<void> {
  await page.waitForTimeout(1500)

  // Fill "Your name" field
  const nameInput = calFrame.getByLabel("Your name")
  await nameInput.waitFor({ state: "visible", timeout: 10000 })
  await nameInput.fill(data.name)
  console.log("✅ Filled: Your name")

  // Fill "Email address" field
  const emailInput = calFrame.getByLabel("Email address")
  await emailInput.fill(data.email)
  console.log("✅ Filled: Email address")
}

test.describe("Real Cal.com Booking Test", () => {
  // Skip in CI - this creates REAL bookings and should only be run locally
  test.skip(!!process.env.CI, "Skipping real Cal.com test in CI")
  test.setTimeout(120000) // 2 minutes

  test("completes a real booking on Cal.com and captures the calendar event", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/calendar-embed-cal.html")
    console.log("✅ Page loaded")

    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 15000 })
    console.log("✅ Outlit SDK initialized")

    const calFrame = page.frameLocator('iframe[title="Book a call"]')
    await calFrame.locator("main").waitFor({ state: "visible", timeout: 30000 })
    console.log("✅ Cal.com loaded")

    await selectFirstAvailableTimeSlot(calFrame, page)

    await fillSimpleBookingForm(calFrame, page, {
      name: "Outlit CI Test",
      email: "ci-test@outlit.dev",
    })

    // Click Confirm
    const confirmBtn = calFrame.getByRole("button", { name: "Confirm" })
    await confirmBtn.waitFor({ state: "visible", timeout: 5000 })
    await confirmBtn.click()
    console.log("✅ Submitted booking")

    // Wait for booking confirmation
    await page.waitForFunction(
      () => (window as unknown as { __calendarEventReceived?: boolean }).__calendarEventReceived,
      { timeout: 45000 },
    )
    console.log("✅ Booking confirmed!")

    const bookingData = await page.evaluate(
      () => (window as unknown as { __lastBookingData?: unknown }).__lastBookingData,
    )
    console.log("📅 Booking:", JSON.stringify(bookingData, null, 2))

    // Flush events
    await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")))
    await page.waitForTimeout(1000)

    // Verify calendar event captured
    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const calendarEvent = allEvents.find((e) => e.type === "calendar" && e.eventType)

    expect(calendarEvent).toBeDefined()
    expect(calendarEvent?.provider).toBe("cal.com")
    expect(calendarEvent?.eventType).toContain("15 Min Meeting")
    expect(calendarEvent?.duration).toBe(15)
    expect(calendarEvent?.inviteeName).toBe("Outlit CI Test")

    // Note: Email is NOT available from Cal.com client-side events
    // Use server-side webhooks for identify()
    console.log("✅ PASSED!", JSON.stringify(calendarEvent, null, 2))
  })
})

// Window.outlit type is declared in global.d.ts
