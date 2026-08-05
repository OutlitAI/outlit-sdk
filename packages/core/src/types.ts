import type { GeneratedIngestPayload, GeneratedIngestResponse } from "./generated/ingest-wire-types"

// ============================================
// CORE-OWNED INGEST WIRE TYPES
// ============================================

export type IngestPayload = GeneratedIngestPayload
export type IngestResponse = GeneratedIngestResponse
export type TrackerEvent = IngestPayload["events"][number]
export type EventType = TrackerEvent["type"]
export type SourceType = NonNullable<IngestPayload["source"]>
export type PageviewEvent = Extract<TrackerEvent, { type: "pageview" }>
export type FormEvent = Extract<TrackerEvent, { type: "form" }>
export type IdentifyEvent = Extract<TrackerEvent, { type: "identify" }>
export type CustomEvent = Extract<TrackerEvent, { type: "custom" }>
export type CalendarEvent = Extract<TrackerEvent, { type: "calendar" }>
export type EngagementEvent = Extract<TrackerEvent, { type: "engagement" }>
export type CalendarProvider = CalendarEvent["provider"]
export type PayloadUserIdentity = NonNullable<IngestPayload["userIdentity"]>
export type PayloadCustomerIdentity = NonNullable<IngestPayload["customerIdentity"]>

// ============================================
// UTM PARAMETERS
// ============================================

export interface UtmParams {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
  ref?: string
}

// ============================================
// TRACKER CONFIGURATION
// ============================================

export interface TrackerConfig {
  publicKey: string
  apiHost?: string // default: 'https://app.outlit.ai'
}

// ============================================
// BROWSER-SPECIFIC TYPES (anonymous allowed)
// visitorId is auto-managed by the browser SDK
// ============================================

export interface BrowserTrackOptions {
  eventName: string
  properties?: Record<string, string | number | boolean | null>
}

export interface BrowserIdentifyOptions extends CustomerAttribution {
  email?: string
  /** Your system-owned user/contact ID. */
  userId?: string
  /** User/contact traits. */
  traits?: IdentifyTraits
  /** Customer/account-level traits. */
  customerTraits?: CustomerTraits
}

// ============================================
// SERVER-SPECIFIC TYPES
// Track calls can use user identity, customer attribution, or both.
// Identify calls remain user-scoped and require email or userId.
// ============================================

/**
 * Base server-side user identity.
 * Track calls may use customerId without these fields.
 * Identify calls still require email or userId at runtime.
 * `customerId`-only track calls are valid immediately, but they stay provisional
 * until the same customer/account/workspace later appears on identify() with
 * the matching customerId and an email.
 *
 * - fingerprint: Device identifier for anonymous tracking (can be linked later)
 * - email: User's email address (definitive identity, resolves immediately)
 * - userId: Your system-owned user/contact ID
 */
export interface ServerIdentity {
  fingerprint?: string
  email?: string
  /** Your system-owned user/contact ID. */
  userId?: string
}

export interface CustomerAttribution {
  /** Your system-owned customer/account/workspace ID. */
  customerId?: string
}

// ============================================
// TRAITS
// ============================================

export interface CustomerTraits {
  /** Customer's billing plan */
  plan?: string
  /** Allow additional custom properties */
  [key: string]: string | number | boolean | null | undefined
}

/**
 * Traits for identify calls.
 * These are user/contact traits, not customer/account traits.
 */
export interface IdentifyTraits {
  /** User-level traits */
  [key: string]: string | number | boolean | null | undefined
}

/**
 * Input accepted by the payload builder. Deprecated customer fields are lifted
 * into the wire-level `customerIdentity` object and are never sent in `userIdentity`.
 */
export type PayloadUserIdentityInput = Omit<PayloadUserIdentity, "traits"> & {
  /** User/contact traits. */
  traits?: IdentifyTraits
  /** @deprecated Pass `customerIdentity.customerId` to the payload builder instead. */
  customerId?: string
  /** @deprecated Pass `customerIdentity.customerTraits` to the payload builder instead. */
  customerTraits?: CustomerTraits
}

export interface PayloadCustomerIdentityInput extends CustomerAttribution {
  /** Customer/account traits. */
  customerTraits?: CustomerTraits
}

export interface ServerTrackOptions extends ServerIdentity, CustomerAttribution {
  eventName: string
  properties?: Record<string, string | number | boolean | null>
  timestamp?: number
}

export interface ServerIdentifyOptions extends ServerIdentity, CustomerAttribution {
  traits?: IdentifyTraits
  customerTraits?: CustomerTraits
}

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_API_HOST = "https://app.outlit.ai"

// Re-export for convenience
export type { PayloadUserIdentity as UserIdentity }

export const DEFAULT_DENIED_FORM_FIELDS = [
  "password",
  "passwd",
  "pass",
  "pwd",
  "token",
  "secret",
  "api_key",
  "apikey",
  "api-key",
  "credit_card",
  "creditcard",
  "credit-card",
  "cc_number",
  "ccnumber",
  "card_number",
  "cardnumber",
  "cvv",
  "cvc",
  "ssn",
  "social_security",
  "socialsecurity",
  "bank_account",
  "bankaccount",
  "routing_number",
  "routingnumber",
]
