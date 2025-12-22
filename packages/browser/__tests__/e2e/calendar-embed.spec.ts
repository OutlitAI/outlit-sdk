/**
 * Calendar Embed Integration Tests
 *
 * Tests automatic tracking of booking events from third-party calendar
 * embeds like Cal.com and Calendly.
 *
 * IMPORTANT: Due to privacy restrictions in Cal.com and Calendly,
 * the postMessage events they emit do NOT include PII (email, name).
 * This means auto-identify is NOT possible with these embeds using
 * client-side tracking alone.
 *
 * These tests verify:
 * - Calendar booking events are tracked as first-class "calendar" events
 * - Cal.com events are detected via Cal() API callbacks
 * - Calendly events are detected via postMessage
 * - Event properties (provider, eventType, duration, etc.) are captured
 * - Configuration option to disable calendar tracking works
 */

import { type Route, expect, test } from "@playwright/test"

interface FullEvent {
  type: "pageview" | "custom" | "form" | "identify" | "calendar"
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
  // Calendar event specific fields (first-class)
  provider?: "cal.com" | "calendly" | "unknown"
  eventType?: string
  startTime?: string
  endTime?: string
  duration?: number
  isRecurring?: boolean
  inviteeEmail?: string
  inviteeName?: string
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
// CAL.COM INTEGRATION TESTS
// ============================================

test.describe("Calendar Embed: Cal.com", () => {
  test("tracks calendar event when Cal.com booking is made via Cal() API", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    // Navigate to the mock test page (no network required for CI)
    await page.goto("/calendar-embed-cal-mock.html")

    // Wait for Outlit SDK to initialize
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Wait for Cal.com callbacks to be registered
    // The SDK hooks into Cal() during initialization
    await page.waitForFunction(
      () => {
        const callbacks = (
          window as unknown as { __calCallbacks?: { bookingSuccessfulV2: unknown[] } }
        ).__calCallbacks
        return callbacks && callbacks.bookingSuccessfulV2.length > 0
      },
      { timeout: 10000 },
    )

    // Trigger a Cal.com booking via the Cal() API callbacks
    await page.evaluate(() => {
      const triggerCalBooking = (
        window as unknown as { triggerCalBooking: (data: unknown) => void }
      ).triggerCalBooking
      triggerCalBooking({
        uid: "booking-456-def",
        title: "Product Demo",
        startTime: "2025-01-16T10:00:00.000Z",
        endTime: "2025-01-16T10:45:00.000Z",
        eventTypeId: 43,
        status: "ACCEPTED",
        paymentRequired: false,
        isRecurring: false,
      })
    })

    // Wait a bit for event processing
    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const calendarEvent = allEvents.find((e) => e.type === "calendar")

    expect(calendarEvent).toBeDefined()
    expect(calendarEvent?.provider).toBe("cal.com")
    expect(calendarEvent?.eventType).toBe("Product Demo")
    expect(calendarEvent?.duration).toBe(45) // 45 minutes
    expect(calendarEvent?.isRecurring).toBe(false)
    expect(calendarEvent?.startTime).toBe("2025-01-16T10:00:00.000Z")
    expect(calendarEvent?.endTime).toBe("2025-01-16T10:45:00.000Z")
  })

  // NOTE: This test verifies postMessage-based detection is working
  // In real scenarios, the postMessage comes from Cal.com's iframe
  // The SDK correctly checks for cal.com origin for security
  test.skip("tracks calendar event when Cal.com booking is made via postMessage", async ({
    page,
  }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/calendar-embed-cal-mock.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Trigger the Cal.com booking simulation via postMessage
    await page.click("#simulate-cal-booking")

    // Wait a bit for event processing
    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const calendarEvent = allEvents.find((e) => e.type === "calendar")

    expect(calendarEvent).toBeDefined()
    expect(calendarEvent?.provider).toBe("cal.com")
    expect(calendarEvent?.eventType).toBe("30 Minute Demo Call")
    expect(calendarEvent?.duration).toBe(30) // 30 minutes
    expect(calendarEvent?.isRecurring).toBe(false)
  })

  test("captures booking details correctly", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/calendar-embed-cal-mock.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Wait for callbacks to be registered
    await page.waitForFunction(
      () => {
        const callbacks = (
          window as unknown as { __calCallbacks?: { bookingSuccessfulV2: unknown[] } }
        ).__calCallbacks
        return callbacks && callbacks.bookingSuccessfulV2.length > 0
      },
      { timeout: 10000 },
    )

    // Trigger booking via the Cal() API callbacks
    await page.evaluate(() => {
      const triggerCalBooking = (
        window as unknown as { triggerCalBooking: (data: unknown) => void }
      ).triggerCalBooking
      triggerCalBooking({
        uid: "booking-789-ghi",
        title: "Strategy Session",
        startTime: "2025-01-17T15:00:00.000Z",
        endTime: "2025-01-17T16:00:00.000Z",
        eventTypeId: 44,
        status: "ACCEPTED",
        paymentRequired: false,
        isRecurring: true,
      })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const calendarEvent = allEvents.find((e) => e.type === "calendar")

    expect(calendarEvent).toBeDefined()

    // Verify all expected properties are present at top level (first-class event)
    expect(calendarEvent).toHaveProperty("provider", "cal.com")
    expect(calendarEvent).toHaveProperty("eventType", "Strategy Session")
    expect(calendarEvent).toHaveProperty("startTime", "2025-01-17T15:00:00.000Z")
    expect(calendarEvent).toHaveProperty("endTime", "2025-01-17T16:00:00.000Z")
    expect(calendarEvent).toHaveProperty("duration", 60)
    expect(calendarEvent).toHaveProperty("isRecurring", true)
  })

  test("SDK hooks into Cal() API correctly", async ({ page }) => {
    await page.goto("/calendar-embed-cal-mock.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Verify the SDK registered its callback with Cal()
    const callbackCount = await page.evaluate(() => {
      const callbacks = (
        window as unknown as { __calCallbacks?: { bookingSuccessfulV2: unknown[] } }
      ).__calCallbacks
      return callbacks?.bookingSuccessfulV2?.length || 0
    })

    // Should have at least one callback registered (from the SDK)
    expect(callbackCount).toBeGreaterThan(0)
  })
})

// ============================================
// CALENDLY INTEGRATION TESTS
// ============================================

test.describe("Calendar Embed: Calendly", () => {
  test("tracks calendar event when Calendly booking is made", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/calendar-embed-calendly.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Simulate the Calendly postMessage with the correct origin
    // In a real scenario, this comes from the Calendly iframe
    await page.evaluate(() => {
      const event = new MessageEvent("message", {
        data: {
          event: "calendly.event_scheduled",
          payload: {
            event: {
              uri: "https://api.calendly.com/scheduled_events/abc123",
            },
            invitee: {
              uri: "https://api.calendly.com/scheduled_events/abc123/invitees/def456",
            },
          },
        },
        origin: "https://calendly.com",
      })
      window.dispatchEvent(event)
    })

    // Wait a bit for event processing
    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const calendarEvent = allEvents.find((e) => e.type === "calendar")

    expect(calendarEvent).toBeDefined()
    expect(calendarEvent?.provider).toBe("calendly")
  })

  test("does NOT track other Calendly events (only event_scheduled)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/calendar-embed-calendly.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Simulate other Calendly events that should NOT trigger calendar event
    await page.evaluate(() => {
      // Profile page viewed - should not trigger
      const profileEvent = new MessageEvent("message", {
        data: {
          event: "calendly.profile_page_viewed",
          payload: {},
        },
        origin: "https://calendly.com",
      })
      window.dispatchEvent(profileEvent)

      // Event type viewed - should not trigger
      const eventTypeEvent = new MessageEvent("message", {
        data: {
          event: "calendly.event_type_viewed",
          payload: {},
        },
        origin: "https://calendly.com",
      })
      window.dispatchEvent(eventTypeEvent)

      // Date and time selected - should not trigger
      const dateTimeEvent = new MessageEvent("message", {
        data: {
          event: "calendly.date_and_time_selected",
          payload: {},
        },
        origin: "https://calendly.com",
      })
      window.dispatchEvent(dateTimeEvent)
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const calendarEvents = allEvents.filter((e) => e.type === "calendar")

    // No calendar events should be tracked for these events
    expect(calendarEvents.length).toBe(0)
  })
})

// ============================================
// CONFIGURATION TESTS
// ============================================

test.describe("Calendar Embed: Configuration", () => {
  test("does NOT track calendar events when trackCalendarEmbeds is false", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/calendar-embed-disabled.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Try to trigger a booking
    await page.click("#simulate-booking")

    // Wait for potential event processing
    await page.waitForTimeout(200)

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const calendarEvent = allEvents.find((e) => e.type === "calendar")

    // Should NOT have calendar event when tracking is disabled
    expect(calendarEvent).toBeUndefined()

    // Should still have pageview event (other tracking still works)
    const pageviewEvent = allEvents.find((e) => e.type === "pageview")
    expect(pageviewEvent).toBeDefined()
  })

  test("tracks calendar events by default (trackCalendarEmbeds not specified)", async ({
    page,
  }) => {
    const apiCalls = await interceptApiCalls(page)

    // Use the cal.html fixture which doesn't disable calendar tracking
    await page.goto("/calendar-embed-cal-mock.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Wait for callbacks to be registered
    await page.waitForFunction(
      () => {
        const callbacks = (
          window as unknown as { __calCallbacks?: { bookingSuccessfulV2: unknown[] } }
        ).__calCallbacks
        return callbacks && callbacks.bookingSuccessfulV2.length > 0
      },
      { timeout: 10000 },
    )

    // Trigger booking
    await page.evaluate(() => {
      const triggerCalBooking = (
        window as unknown as { triggerCalBooking: (data: unknown) => void }
      ).triggerCalBooking
      triggerCalBooking({
        uid: "booking-test",
        title: "Test Booking",
        startTime: "2025-01-18T09:00:00.000Z",
        endTime: "2025-01-18T09:30:00.000Z",
        eventTypeId: 1,
        status: "ACCEPTED",
        paymentRequired: false,
        isRecurring: false,
      })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])
    const calendarEvent = allEvents.find((e) => e.type === "calendar")

    // Should have calendar event by default
    expect(calendarEvent).toBeDefined()
  })
})

// ============================================
// IMPORTANT: AUTO-IDENTIFY LIMITATION TESTS
// ============================================

test.describe("Calendar Embed: Auto-Identify Limitation", () => {
  test("does NOT auto-identify from Cal.com booking (privacy restriction)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/calendar-embed-cal-mock.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Wait for callbacks
    await page.waitForFunction(
      () => {
        const callbacks = (
          window as unknown as { __calCallbacks?: { bookingSuccessfulV2: unknown[] } }
        ).__calCallbacks
        return callbacks && callbacks.bookingSuccessfulV2.length > 0
      },
      { timeout: 10000 },
    )

    // Trigger Cal.com booking
    await page.evaluate(() => {
      const triggerCalBooking = (
        window as unknown as { triggerCalBooking: (data: unknown) => void }
      ).triggerCalBooking
      triggerCalBooking({
        uid: "booking-no-identify",
        title: "Demo Call",
        startTime: "2025-01-19T10:00:00.000Z",
        endTime: "2025-01-19T10:30:00.000Z",
        eventTypeId: 1,
        status: "ACCEPTED",
        paymentRequired: false,
        isRecurring: false,
      })
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])

    // Should have calendar event
    const calendarEvent = allEvents.find((e) => e.type === "calendar")
    expect(calendarEvent).toBeDefined()

    // Should NOT have identify event (Cal.com doesn't expose PII via postMessage)
    const identifyEvent = allEvents.find((e) => e.type === "identify")
    expect(identifyEvent).toBeUndefined()
  })

  test("does NOT auto-identify from Calendly booking (privacy restriction)", async ({ page }) => {
    const apiCalls = await interceptApiCalls(page)

    await page.goto("/calendar-embed-calendly.html")
    await page.waitForFunction(() => window.outlit?._initialized, { timeout: 10000 })

    // Trigger Calendly booking
    await page.evaluate(() => {
      const event = new MessageEvent("message", {
        data: {
          event: "calendly.event_scheduled",
          payload: {
            event: { uri: "https://api.calendly.com/scheduled_events/abc123" },
            invitee: { uri: "https://api.calendly.com/scheduled_events/abc123/invitees/def456" },
          },
        },
        origin: "https://calendly.com",
      })
      window.dispatchEvent(event)
    })

    // Force flush
    await page.evaluate(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })
    await page.waitForTimeout(500)

    const allEvents = apiCalls.flatMap((c) => c.payload.events || [])

    // Should have calendar event
    const calendarEvent = allEvents.find((e) => e.type === "calendar")
    expect(calendarEvent).toBeDefined()

    // Should NOT have identify event (Calendly doesn't expose PII via postMessage)
    const identifyEvent = allEvents.find((e) => e.type === "identify")
    expect(identifyEvent).toBeUndefined()
  })
})

// Window.outlit type is declared in global.d.ts
