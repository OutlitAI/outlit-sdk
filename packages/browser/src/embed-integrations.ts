/**
 * Third-party Embed Integrations
 *
 * This module handles automatic tracking of booking events from
 * third-party calendar embeds like Cal.com and Calendly.
 *
 * IMPORTANT: Due to privacy restrictions in Cal.com and Calendly,
 * the postMessage events they emit do NOT include PII (email, name).
 * This means auto-identify is NOT possible with these embeds using
 * client-side tracking alone.
 *
 * For auto-identify functionality with calendar bookings, customers need to:
 * 1. Set up webhooks on their Cal.com/Calendly account
 * 2. Create a server endpoint to receive the webhook
 * 3. Call the Outlit API or use the SDK's identify() when they receive the webhook
 *
 * What this module DOES provide:
 * - Automatic tracking of first-class "calendar" events when bookings are detected
 * - Extraction of non-PII data (event type, duration, etc.) when available
 * - A hook for customers who want to manually trigger identify after getting PII elsewhere
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
  /** Only available if customer passes it manually via onCalendarBooked callback */
  inviteeEmail?: string
  inviteeName?: string
}

export interface CalendarIntegrationCallbacks {
  /** Called when a calendar booking is detected */
  onCalendarBooked: (event: CalendarBookingEvent) => void
  /** Optional: Called when identity info is available (via manual integration) */
  onIdentity?: (identity: { email: string; name?: string }) => void
}

// ============================================
// CAL.COM INTEGRATION
// ============================================

/**
 * Cal.com embed events structure.
 * These come through the Cal() API or as raw postMessages.
 *
 * The bookingSuccessfulV2 event includes:
 * - uid: string - Unique booking ID
 * - title: string - Booking title
 * - startTime: string - ISO timestamp
 * - endTime: string - ISO timestamp
 * - eventTypeId: number
 * - status: string
 * - paymentRequired: boolean
 * - isRecurring: boolean
 *
 * NOTE: It does NOT include invitee email or name (privacy protection)
 */
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

function parseCalComBooking(data: CalComBookingData): CalendarBookingEvent {
  const event: CalendarBookingEvent = {
    provider: "cal.com",
  }

  if (data.title) {
    event.eventType = data.title
  }

  if (data.startTime) {
    event.startTime = data.startTime
  }

  if (data.endTime) {
    event.endTime = data.endTime
  }

  if (data.startTime && data.endTime) {
    const start = new Date(data.startTime)
    const end = new Date(data.endTime)
    event.duration = Math.round((end.getTime() - start.getTime()) / 60000) // minutes
  }

  if (data.isRecurring !== undefined) {
    event.isRecurring = data.isRecurring
  }

  return event
}

// ============================================
// CALENDLY INTEGRATION
// ============================================

/**
 * Calendly embed events come via postMessage.
 *
 * Event types:
 * - calendly.profile_page_viewed
 * - calendly.event_type_viewed
 * - calendly.date_and_time_selected
 * - calendly.event_scheduled
 *
 * The event_scheduled payload includes:
 * - event.uri: string - API URI for the event (requires auth to fetch)
 * - invitee.uri: string - API URI for the invitee (requires auth to fetch)
 *
 * NOTE: Email and name require authenticated API calls, not available client-side
 */
interface CalendlyPayload {
  event?: {
    uri?: string
  }
  invitee?: {
    uri?: string
  }
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
  // Calendly doesn't provide booking details in the postMessage payload
  // Only URIs that require API auth to fetch
  return {
    provider: "calendly",
    // Note: eventType, startTime, etc. would require API calls to fetch
  }
}

// ============================================
// MAIN INTEGRATION
// ============================================

let callbacks: CalendarIntegrationCallbacks | null = null
let isListening = false

/**
 * Initialize calendar embed tracking.
 * Listens for booking events from Cal.com and Calendly embeds.
 */
export function initCalendarTracking(cbs: CalendarIntegrationCallbacks): void {
  if (isListening) {
    return // Already initialized
  }

  callbacks = cbs
  isListening = true

  // Listen for postMessage events (Calendly and potentially raw Cal.com messages)
  window.addEventListener("message", handlePostMessage)

  // Try to hook into Cal.com's Cal() API if it exists
  setupCalComListener()
}

/**
 * Handle postMessage events from calendar embeds.
 */
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

  // Check for raw Cal.com postMessages (they use a specific format)
  // Cal.com embed messages have a specific structure when sent from their iframe
  if (isCalComRawMessage(event)) {
    const bookingData = extractCalComBookingFromMessage(event.data)
    if (bookingData) {
      const bookingEvent = parseCalComBooking(bookingData)
      callbacks.onCalendarBooked(bookingEvent)
    }
  }
}

/**
 * Check if a message is from Cal.com embed.
 * Cal.com embeds are hosted on cal.com or app.cal.com domains.
 */
function isCalComRawMessage(event: MessageEvent): boolean {
  const calComOrigins = ["https://cal.com", "https://app.cal.com"]

  if (!calComOrigins.some((origin) => event.origin.endsWith(origin.replace("https://", "")))) {
    return false
  }

  // Cal.com sends messages with specific action types
  const data = event.data
  return (
    data &&
    typeof data === "object" &&
    (data.type === "booking_successful" ||
      data.action === "bookingSuccessfulV2" ||
      data.action === "bookingSuccessful")
  )
}

/**
 * Extract booking data from Cal.com raw postMessage.
 */
function extractCalComBookingFromMessage(data: unknown): CalComBookingData | null {
  if (!data || typeof data !== "object") {
    return null
  }

  const messageData = data as Record<string, unknown>

  // Cal.com sends booking data in different formats depending on embed version
  if (messageData.data && typeof messageData.data === "object") {
    return messageData.data as CalComBookingData
  }

  if (messageData.booking && typeof messageData.booking === "object") {
    return messageData.booking as CalComBookingData
  }

  return null
}

/**
 * Set up listener for Cal.com's Cal() API if available.
 * This hooks into the official Cal.com embed API.
 */
function setupCalComListener(): void {
  // Check if Cal() API exists (loaded by Cal.com embed script)
  if (typeof window !== "undefined" && "Cal" in window) {
    const Cal = (window as unknown as { Cal: CalFunction }).Cal
    if (typeof Cal === "function") {
      try {
        // Listen for the official booking event
        Cal("on", {
          action: "bookingSuccessfulV2",
          callback: (e: { detail: CalComEventDetail }) => {
            if (callbacks) {
              const bookingEvent = parseCalComBooking(e.detail.data)
              callbacks.onCalendarBooked(bookingEvent)
            }
          },
        })
      } catch {
        // Cal() API might not be fully initialized yet, try again later
        setTimeout(setupCalComListener, 1000)
      }
    }
  } else {
    // Cal.com script might load later, wait and retry
    if (typeof window !== "undefined") {
      const checkInterval = setInterval(() => {
        if ("Cal" in window) {
          clearInterval(checkInterval)
          setupCalComListener()
        }
      }, 500)

      // Stop checking after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000)
    }
  }
}

// Type for Cal.com's Cal() function
type CalFunction = (
  method: string,
  options: {
    action: string
    callback: (e: { detail: CalComEventDetail }) => void
  },
) => void

/**
 * Stop calendar embed tracking.
 */
export function stopCalendarTracking(): void {
  if (!isListening) return

  window.removeEventListener("message", handlePostMessage)
  callbacks = null
  isListening = false
}

/**
 * Check if calendar tracking is active.
 */
export function isCalendarTrackingActive(): boolean {
  return isListening
}
