/**
 * Third-party Embed Integrations
 *
 * This module handles automatic tracking of booking events from
 * third-party calendar embeds like Cal.com and Calendly.
 *
 * Cal.com Integration:
 * - Hooks into Cal() API for booking events via Cal("on", { action: "bookingSuccessfulV2" })
 * - Captures booking details: event type, time, duration, invitee name (from title)
 *
 * IMPORTANT - Email Limitation:
 * Cal.com does NOT expose invitee email in their client-side events for privacy.
 * The email IS in the success page URL, but:
 * 1. iframe.src attribute doesn't update (Cal.com uses client-side routing)
 * 2. contentWindow.location.href is blocked by cross-origin policy
 *
 * To get email from Cal.com bookings, you need SERVER-SIDE WEBHOOKS:
 * 1. Set up Cal.com webhook: Settings → Developer → Webhooks
 * 2. Point it to your server endpoint
 * 3. Server calls Outlit identify() API with the email from webhook payload
 */

import type { CalendarProvider } from "@outlit/core"

// ============================================
// TYPES
// ============================================

export interface CalendarBookingEvent {
  provider: CalendarProvider
  eventType?: string
  startTime?: string
  endTime?: string
  duration?: number
  isRecurring?: boolean
  inviteeEmail?: string
  inviteeName?: string
}

export interface CalendarIntegrationCallbacks {
  onCalendarBooked: (event: CalendarBookingEvent) => void
  onIdentity?: (identity: { email: string; name?: string }) => void
}

// ============================================
// CAL.COM TYPES
// ============================================

interface CalComBookingData {
  uid?: string
  title?: string
  startTime?: string
  endTime?: string
  eventTypeId?: number
  status?: string
  paymentRequired?: boolean
  isRecurring?: boolean
}

interface CalComEventDetail {
  data: CalComBookingData
  type: string
  namespace: string
}

// Cal.com's Cal() function type
type CalFunction = {
  (
    method: "on",
    options: { action: string; callback: (e: { detail: CalComEventDetail }) => void },
  ): void
  (method: string, ...args: unknown[]): void
  loaded?: boolean
  q?: unknown[][]
  ns?: Record<string, unknown>
}

// ============================================
// STATE
// ============================================

let callbacks: CalendarIntegrationCallbacks | null = null
let isListening = false
let calSetupAttempts = 0
let calCallbackRegistered = false
let lastBookingUid: string | null = null // Prevent duplicate events

// ============================================
// CONFIG
// ============================================

const CAL_MAX_RETRY_ATTEMPTS = 10 // Max attempts to find Cal() API
const CAL_INITIAL_DELAY_MS = 200 // Start with short delay
const CAL_MAX_DELAY_MS = 2000 // Cap retry delay at 2s

// ============================================
// CAL.COM BOOKING PARSER
// ============================================

function parseCalComBooking(data: CalComBookingData): CalendarBookingEvent {
  const event: CalendarBookingEvent = {
    provider: "cal.com",
  }

  if (data.title) {
    event.eventType = data.title
    // Extract invitee name from title: "Meeting between Host and Guest"
    const nameMatch = data.title.match(/between .+ and (.+)$/i)
    if (nameMatch?.[1]) {
      event.inviteeName = nameMatch[1].trim()
    }
  }

  if (data.startTime) event.startTime = data.startTime
  if (data.endTime) event.endTime = data.endTime

  if (data.startTime && data.endTime) {
    const start = new Date(data.startTime)
    const end = new Date(data.endTime)
    event.duration = Math.round((end.getTime() - start.getTime()) / 60000)
  }

  if (data.isRecurring !== undefined) {
    event.isRecurring = data.isRecurring
  }

  // Note: Email is NOT available from Cal.com client-side events
  // Use server-side webhooks to get email for identify()

  return event
}

// ============================================
// CAL.COM API INTEGRATION
// ============================================

/**
 * Set up listener for Cal.com's Cal() API.
 * Registers callback via Cal("on", ...) with retries.
 */
function setupCalComListener(): void {
  if (typeof window === "undefined") return
  if (calCallbackRegistered) return

  calSetupAttempts++

  // Check if Cal() API exists
  if ("Cal" in window) {
    const Cal = (window as unknown as { Cal: CalFunction }).Cal

    if (typeof Cal === "function") {
      try {
        Cal("on", {
          action: "bookingSuccessfulV2",
          callback: handleCalComBooking,
        })
        calCallbackRegistered = true
        return
      } catch (_e) {
        // Registration failed, will retry
      }
    }
  }

  // Cal() not ready yet, retry with backoff
  if (calSetupAttempts < CAL_MAX_RETRY_ATTEMPTS) {
    const delay = Math.min(CAL_INITIAL_DELAY_MS * calSetupAttempts, CAL_MAX_DELAY_MS)
    setTimeout(setupCalComListener, delay)
  }
}

function handleCalComBooking(e: { detail: CalComEventDetail }): void {
  if (!callbacks) return

  const data = e.detail?.data
  if (!data) return

  // Prevent duplicate events for the same booking
  if (data.uid && data.uid === lastBookingUid) return
  lastBookingUid = data.uid || null

  const bookingEvent = parseCalComBooking(data)
  callbacks.onCalendarBooked(bookingEvent)
}

// ============================================
// POSTMESSAGE HANDLER (FALLBACK)
// ============================================

function handlePostMessage(event: MessageEvent): void {
  if (!callbacks) return

  // Check for Calendly events
  if (isCalendlyEvent(event)) {
    if (event.data.event === "calendly.event_scheduled") {
      const bookingEvent = parseCalendlyBooking(event.data.payload)
      callbacks.onCalendarBooked(bookingEvent)
    }
    return
  }

  // Check for Cal.com postMessages (fallback if Cal() API not available)
  if (isCalComRawMessage(event)) {
    const bookingData = extractCalComBookingFromMessage(event.data)
    if (bookingData) {
      // Prevent duplicates
      if (bookingData.uid && bookingData.uid === lastBookingUid) return
      lastBookingUid = bookingData.uid || null

      const bookingEvent = parseCalComBooking(bookingData)
      callbacks.onCalendarBooked(bookingEvent)
    }
  }
}

function isCalComRawMessage(event: MessageEvent): boolean {
  if (!event.origin.includes("cal.com")) return false

  const data = event.data
  if (!data || typeof data !== "object") return false

  // Cal.com sends type: 'bookingSuccessfulV2' for successful bookings
  const messageType = data.type || data.action
  return (
    messageType === "bookingSuccessfulV2" ||
    messageType === "bookingSuccessful" ||
    messageType === "booking_successful"
  )
}

function extractCalComBookingFromMessage(data: unknown): CalComBookingData | null {
  if (!data || typeof data !== "object") return null

  const messageData = data as Record<string, unknown>

  // Cal.com sends: { originator: 'CAL', type: 'bookingSuccessfulV2', data: { uid, title, ... } }
  if (messageData.data && typeof messageData.data === "object") {
    return messageData.data as CalComBookingData
  }

  if (messageData.booking && typeof messageData.booking === "object") {
    return messageData.booking as CalComBookingData
  }

  return null
}

// ============================================
// CALENDLY INTEGRATION
// ============================================

interface CalendlyPayload {
  event?: { uri?: string }
  invitee?: { uri?: string }
}

interface CalendlyMessageData {
  event: string
  payload: CalendlyPayload
}

function isCalendlyEvent(e: MessageEvent): e is MessageEvent<CalendlyMessageData> {
  return (
    e.origin === "https://calendly.com" &&
    e.data &&
    typeof e.data.event === "string" &&
    e.data.event.startsWith("calendly.")
  )
}

function parseCalendlyBooking(_payload: CalendlyPayload): CalendarBookingEvent {
  return {
    provider: "calendly",
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Initialize calendar embed tracking.
 */
export function initCalendarTracking(cbs: CalendarIntegrationCallbacks): void {
  if (isListening) return

  callbacks = cbs
  isListening = true
  calSetupAttempts = 0

  // Listen for postMessage events (Calendly, fallback for Cal.com)
  window.addEventListener("message", handlePostMessage)

  // Set up Cal.com API listener
  setupCalComListener()
}

/**
 * Stop calendar embed tracking.
 */
export function stopCalendarTracking(): void {
  if (!isListening) return

  window.removeEventListener("message", handlePostMessage)

  callbacks = null
  isListening = false
  calCallbackRegistered = false
  calSetupAttempts = 0
  lastBookingUid = null
}

/**
 * Check if calendar tracking is active.
 */
export function isCalendarTrackingActive(): boolean {
  return isListening
}
