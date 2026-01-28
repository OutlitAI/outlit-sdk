import type {
  BillingEvent,
  BillingStatus,
  CalendarEvent,
  CalendarProvider,
  CustomEvent,
  EngagementEvent,
  ExplicitJourneyStage,
  FormEvent,
  IdentifyEvent,
  IdentifyTraits,
  IngestPayload,
  PageviewEvent,
  PayloadUserIdentity,
  SourceType,
  StageEvent,
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
    fingerprint?: string
    traits?: IdentifyTraits
  },
): IdentifyEvent {
  const { url, referrer, timestamp, email, userId, fingerprint, traits } = params
  return {
    type: "identify",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    email,
    userId,
    fingerprint,
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

/**
 * Build a stage event.
 * Used to explicitly set customer journey stage (activated, engaged, inactive).
 * discovered/signed_up stages are inferred from identify calls.
 */
export function buildStageEvent(
  params: BaseEventParams & {
    stage: ExplicitJourneyStage
    properties?: Record<string, string | number | boolean | null>
  },
): StageEvent {
  const { url, referrer, timestamp, stage, properties } = params
  return {
    type: "stage",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    stage,
    properties,
  }
}

/**
 * Build a billing event.
 * Used to set customer billing status (trialing, paid, churned).
 */
export function buildBillingEvent(
  params: BaseEventParams & {
    status: BillingStatus
    customerId?: string
    stripeCustomerId?: string
    domain?: string
    properties?: Record<string, string | number | boolean | null>
  },
): BillingEvent {
  const { url, referrer, timestamp, status, customerId, stripeCustomerId, domain, properties } =
    params
  return {
    type: "billing",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    status,
    customerId,
    stripeCustomerId,
    domain,
    properties,
  }
}

// ============================================
// PAYLOAD BUILDER
// ============================================

/**
 * Build an ingest payload from events.
 *
 * @param visitorId - The anonymous visitor ID from browser cookie/storage
 * @param source - The event source (client, server, integration)
 * @param events - Array of events to send
 * @param userIdentity - Optional user identity for immediate resolution (from setUser in SPA)
 * @param sessionId - Optional session ID for grouping events (browser SDK only)
 * @param fingerprint - Optional device identifier for server-side anonymous tracking
 */
export function buildIngestPayload(
  visitorId: string,
  source: SourceType,
  events: TrackerEvent[],
  userIdentity?: PayloadUserIdentity,
  sessionId?: string,
  fingerprint?: string,
): IngestPayload {
  const payload: IngestPayload = {
    visitorId,
    source,
    events,
  }

  // Only include fingerprint if provided (server SDK only)
  if (fingerprint) {
    payload.fingerprint = fingerprint
  }

  // Only include sessionId if provided (browser SDK only)
  if (sessionId) {
    payload.sessionId = sessionId
  }

  // Only include userIdentity if it has actual values
  if (userIdentity && (userIdentity.email || userIdentity.userId)) {
    payload.userIdentity = {
      ...(userIdentity.email && { email: userIdentity.email }),
      ...(userIdentity.userId && { userId: userIdentity.userId }),
    }
  }

  return payload
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
