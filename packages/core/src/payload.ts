import { v7 as uuidv7 } from "uuid"
import { ingestTransport } from "./generated/ingest-contract"
import type {
  CalendarEvent,
  CalendarProvider,
  CustomEvent,
  CustomerTraits,
  EngagementEvent,
  FormEvent,
  IdentifyEvent,
  IdentifyTraits,
  IngestPayload,
  PageviewEvent,
  PayloadCustomerIdentityInput,
  PayloadUserIdentityInput,
  SourceType,
  TrackerEvent,
} from "./types"
import { extractPathFromUrl, extractUtmParams } from "./utils"

type WireTraitValue = string | number | boolean | null

function normalizeTraits(
  traits: CustomerTraits | IdentifyTraits | undefined,
): Record<string, WireTraitValue> | undefined {
  if (!traits) return undefined

  const normalized: Record<string, WireTraitValue> = {}
  for (const [key, value] of Object.entries(traits)) {
    if (value !== undefined) normalized[key] = value
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

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
    uuid: uuidv7(),
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
    uuid: uuidv7(),
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
    customerId?: string
    customerTraits?: CustomerTraits
  },
): IdentifyEvent {
  const {
    url,
    referrer,
    timestamp,
    email,
    userId,
    fingerprint,
    traits,
    customerId,
    customerTraits,
  } = params
  return {
    uuid: uuidv7(),
    type: "identify",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    email,
    userId,
    fingerprint,
    customerId,
    customerTraits: normalizeTraits(customerTraits),
    traits: normalizeTraits(traits),
  }
}

/**
 * Build a custom event.
 */
export function buildCustomEvent(
  params: BaseEventParams & {
    eventName: string
    properties?: Record<string, string | number | boolean | null>
    email?: string
    userId?: string
    fingerprint?: string
    customerId?: string
  },
): CustomEvent {
  const {
    url,
    referrer,
    timestamp,
    eventName,
    properties,
    email,
    userId,
    fingerprint,
    customerId,
  } = params
  return {
    uuid: uuidv7(),
    type: "custom",
    timestamp: timestamp ?? Date.now(),
    url,
    path: extractPathFromUrl(url),
    referrer,
    utm: extractUtmParams(url),
    eventName,
    email,
    userId,
    fingerprint,
    customerId,
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
    uuid: uuidv7(),
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
    uuid: uuidv7(),
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
 *
 * @param visitorId - The anonymous visitor ID from browser cookie/storage
 * @param source - The event source (client, server, integration)
 * @param events - Array of events to send
 * @param userIdentity - Optional user identity for immediate resolution (from setUser in SPA)
 * @param sessionId - Optional session ID for grouping events (browser SDK only)
 * @param fingerprint - Optional device identifier for server-side anonymous tracking
 * @param customerIdentity - Optional customer identity for batch attribution. `customerId`-only
 * batches are valid and remain provisional until a later identify(email, customerId) call
 * links that external account/workspace to a resolved customer.
 */
export function buildIngestPayload(
  visitorId: string,
  source: SourceType,
  events: TrackerEvent[],
  userIdentity?: PayloadUserIdentityInput,
  sessionId?: string,
  fingerprint?: string,
  customerIdentity?: PayloadCustomerIdentityInput,
): IngestPayload {
  const payload: IngestPayload = {
    visitorId,
    source,
    events,
  }
  const legacyCustomerIdentity =
    customerIdentity === undefined &&
    userIdentity &&
    (userIdentity.customerId || userIdentity.customerTraits)
      ? {
          ...(userIdentity.customerId && { customerId: userIdentity.customerId }),
          ...(userIdentity.customerTraits && { customerTraits: userIdentity.customerTraits }),
        }
      : undefined
  const resolvedCustomerIdentity = customerIdentity ?? legacyCustomerIdentity
  const userTraits = normalizeTraits(userIdentity?.traits)
  const customerTraits = normalizeTraits(resolvedCustomerIdentity?.customerTraits)

  // Only include fingerprint if provided (server SDK only)
  if (fingerprint) {
    payload.fingerprint = fingerprint
  }

  // Only include sessionId if provided (browser SDK only)
  if (sessionId) {
    payload.sessionId = sessionId
  }

  // Only include userIdentity if it has actual values
  if (
    userIdentity &&
    (userIdentity.email || userIdentity.userId || userIdentity.fingerprint || userTraits)
  ) {
    payload.userIdentity = {
      ...(userIdentity.email && { email: userIdentity.email }),
      ...(userIdentity.userId && { userId: userIdentity.userId }),
      ...(userIdentity.fingerprint && { fingerprint: userIdentity.fingerprint }),
      ...(userTraits && { traits: userTraits }),
    }
  }

  if (resolvedCustomerIdentity && (resolvedCustomerIdentity.customerId || customerTraits)) {
    payload.customerIdentity = {
      ...(resolvedCustomerIdentity.customerId && {
        customerId: resolvedCustomerIdentity.customerId,
      }),
      ...(customerTraits && { customerTraits }),
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
export const MAX_BATCH_SIZE = ingestTransport.maxBatchSize

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
