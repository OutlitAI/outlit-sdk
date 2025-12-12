import type {
  CalendarEvent,
  CalendarProvider,
  CustomEvent,
  EngagementEvent,
  FormEvent,
  IdentifyEvent,
  IngestPayload,
  PageviewEvent,
  SourceType,
  TrackerEvent,
  UtmParams,
} from "./types"
import { extractPathFromUrl, extractUtmParams } from "./utils"

// ============================================
// EVENT BUILDERS
// ============================================

interface BaseEventParams {
  url: string
  referrer?: string
  timestamp?: number
}

/**
 * Build a pageview event.
 */
export function buildPageviewEvent(params: BaseEventParams & { title?: string }): PageviewEvent {
  const { url, referrer, timestamp, title } = params
  return {
    type: "pageview",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    title,
  }
}

/**
 * Build a form event.
 */
export function buildFormEvent(
  params: BaseEventParams & {
    formId?: string
    formFields?: Record<string, string>
  },
): FormEvent {
  const { url, referrer, timestamp, formId, formFields } = params
  return {
    type: "form",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    formId,
    formFields,
  }
}

/**
 * Build an identify event.
 */
export function buildIdentifyEvent(
  params: BaseEventParams & {
    email?: string
    userId?: string
    traits?: Record<string, string | number | boolean | null>
  },
): IdentifyEvent {
  const { url, referrer, timestamp, email, userId, traits } = params
  return {
    type: "identify",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    email,
    userId,
    traits,
  }
}

/**
 * Build a custom event.
 */
export function buildCustomEvent(
  params: BaseEventParams & {
    eventName: string
    properties?: Record<string, string | number | boolean | null>
  },
): CustomEvent {
  const { url, referrer, timestamp, eventName, properties } = params
  return {
    type: "custom",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    eventName,
    properties,
  }
}

/**
 * Build a calendar booking event.
 */
export function buildCalendarEvent(
  params: BaseEventParams & {
    provider: CalendarProvider
    eventType?: string
    startTime?: string
    endTime?: string
    duration?: number
    isRecurring?: boolean
    inviteeEmail?: string
    inviteeName?: string
  },
): CalendarEvent {
  const {
    url,
    referrer,
    timestamp,
    provider,
    eventType,
    startTime,
    endTime,
    duration,
    isRecurring,
    inviteeEmail,
    inviteeName,
  } = params
  return {
    type: "calendar",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    provider,
    eventType,
    startTime,
    endTime,
    duration,
    isRecurring,
    inviteeEmail,
    inviteeName,
  }
}

/**
 * Build an engagement event.
 * Captures active time on page for session analytics.
 */
export function buildEngagementEvent(
  params: BaseEventParams & {
    activeTimeMs: number
    totalTimeMs: number
    sessionId: string
  },
): EngagementEvent {
  const { url, referrer, timestamp, activeTimeMs, totalTimeMs, sessionId } = params
  return {
    type: "engagement",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    activeTimeMs,
    totalTimeMs,
    sessionId,
  }
}

// ============================================
// PAYLOAD BUILDER
// ============================================

/**
 * Build an ingest payload from events.
 */
export function buildIngestPayload(
  visitorId: string,
  source: SourceType,
  events: TrackerEvent[],
): IngestPayload {
  return {
    visitorId,
    source,
    events,
  }
}

// ============================================
// BATCH HELPERS
// ============================================

/**
 * Maximum number of events in a single batch.
 */
export const MAX_BATCH_SIZE = 100

/**
 * Split events into batches of MAX_BATCH_SIZE.
 */
export function batchEvents(events: TrackerEvent[]): TrackerEvent[][] {
  const batches: TrackerEvent[][] = []
  for (let i = 0; i < events.length; i += MAX_BATCH_SIZE) {
    batches.push(events.slice(i, i + MAX_BATCH_SIZE))
  }
  return batches
}
