// ============================================
// EVENT TYPES
// ============================================

export type EventType =
  | "pageview"
  | "form"
  | "identify"
  | "custom"
  | "calendar"
  | "engagement"
  | "stage"
  | "billing"

// Only explicit stages - discovered/signed_up are inferred from identify calls
export type ExplicitJourneyStage = "activated" | "engaged" | "inactive"

export type BillingStatus = "trialing" | "paid" | "churned"

export type CalendarProvider = "cal.com" | "calendly" | "unknown"

export type SourceType = "client" | "server" | "integration"

// ============================================
// UTM PARAMETERS
// ============================================

export interface UtmParams {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
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

export interface BrowserIdentifyOptions {
  email?: string
  userId?: string
  traits?: IdentifyTraits
}

// ============================================
// SERVER-SPECIFIC TYPES (identity required)
// No anonymous tracking - must identify the user
// ============================================

/**
 * Server identity - requires at least one of fingerprint, email, or userId.
 * This is validated at runtime to avoid complex union types that
 * cause TypeScript memory issues during type checking.
 *
 * - fingerprint: Device identifier for anonymous tracking (can be linked later)
 * - email: User's email address (definitive identity, resolves immediately)
 * - userId: App's internal user ID
 */
export interface ServerIdentity {
  fingerprint?: string
  email?: string
  userId?: string
}

// ============================================
// IDENTIFY TRAITS (with optional customer nesting)
// ============================================

/**
 * Customer-level traits that can be nested under `customer` in identify.
 * These are applied to the customer/account, not the individual user.
 */
export interface CustomerTraits {
  /** Customer's billing plan */
  plan?: string
  /** Allow additional custom properties */
  [key: string]: string | number | boolean | null | undefined
}

/**
 * Traits for identify calls, supporting both user-level
 * and nested customer-level properties.
 */
export interface IdentifyTraits {
  /** Nested customer/account-level traits */
  customer?: CustomerTraits
  /** User-level traits */
  [key: string]: string | number | boolean | null | CustomerTraits | undefined
}

export interface ServerTrackOptions extends ServerIdentity {
  eventName: string
  properties?: Record<string, string | number | boolean | null>
  timestamp?: number
}

export interface ServerIdentifyOptions extends ServerIdentity {
  traits?: IdentifyTraits
}

/**
 * Customer identity for SDK billing methods.
 * Domain is required as the primary identifier; additional identifiers are optional.
 */
export interface CustomerIdentifier {
  /** Required: The customer's domain (e.g., "acme.com") */
  domain: string
  /** Optional: Your internal customer ID */
  customerId?: string
  /** Optional: Stripe customer ID (e.g., "cus_xxx") */
  stripeCustomerId?: string
}

// ============================================
// INTERNAL EVENT TYPES
// These are the full event objects sent to the API
// ============================================

interface BaseEvent {
  type: EventType
  timestamp: number // Unix timestamp in milliseconds
  url: string
  path: string
  referrer?: string
  utm?: UtmParams
}

export interface PageviewEvent extends BaseEvent {
  type: "pageview"
  title?: string
}

export interface FormEvent extends BaseEvent {
  type: "form"
  formId?: string
  formFields?: Record<string, string>
}

export interface IdentifyEvent extends BaseEvent {
  type: "identify"
  email?: string
  userId?: string
  fingerprint?: string
  traits?: IdentifyTraits
}

export interface CustomEvent extends BaseEvent {
  type: "custom"
  eventName: string
  properties?: Record<string, string | number | boolean | null>
}

export interface CalendarEvent extends BaseEvent {
  type: "calendar"
  provider: CalendarProvider
  eventType?: string // e.g., "30 Minute Meeting"
  startTime?: string // ISO timestamp
  endTime?: string // ISO timestamp
  duration?: number // Duration in minutes
  isRecurring?: boolean
  /** Available when identity is passed via webhooks or manual integration */
  inviteeEmail?: string
  inviteeName?: string
}

export interface EngagementEvent extends BaseEvent {
  type: "engagement"
  /** Time in milliseconds the user was actively engaged (visible tab + user interactions) */
  activeTimeMs: number
  /** Total wall-clock time in milliseconds on the page */
  totalTimeMs: number
  /** Session ID for grouping engagement events. Resets after 30 min of inactivity or tab close. */
  sessionId: string
}

export interface StageEvent extends BaseEvent {
  type: "stage"
  /** The journey stage to set (only explicit stages, discovered/signed_up are inferred) */
  stage: ExplicitJourneyStage
  /** Optional properties for context */
  properties?: Record<string, string | number | boolean | null>
}

export interface BillingEvent extends BaseEvent {
  type: "billing"
  /** The billing status to set for a customer */
  status: BillingStatus
  /** Optional customer identifiers */
  customerId?: string
  stripeCustomerId?: string
  domain?: string
  /** Optional properties for context */
  properties?: Record<string, string | number | boolean | null>
}

export type TrackerEvent =
  | PageviewEvent
  | FormEvent
  | IdentifyEvent
  | CustomEvent
  | CalendarEvent
  | EngagementEvent
  | StageEvent
  | BillingEvent

// ============================================
// INGEST PAYLOAD
// This is what gets sent to the API
// ============================================

/**
 * User identity for payload-level resolution.
 * Used by browser SDK when user is logged in (via setUser).
 */
export interface PayloadUserIdentity {
  email?: string
  userId?: string
}

export interface IngestPayload {
  visitorId?: string // Required for pixel, optional for server
  source: SourceType
  events: TrackerEvent[]
  /**
   * Device identifier for anonymous tracking.
   * Events with fingerprint can be linked to users later via identify.
   * Only present for server-side events.
   */
  fingerprint?: string
  /**
   * Session ID for grouping all events in this batch.
   * Only present for browser (client) source events.
   * Used to correlate pageviews, forms, custom events, and engagement
   * within the same browsing session.
   */
  sessionId?: string
  /**
   * User identity for this batch of events.
   * When present, the server can resolve directly to CustomerContact
   * instead of relying on anonymous visitor flow.
   *
   * This is set by the browser SDK when setUser() has been called,
   * allowing immediate identity resolution for SPA/React apps.
   */
  userIdentity?: PayloadUserIdentity
}

// ============================================
// API RESPONSE
// ============================================

export interface IngestResponse {
  success: boolean
  processed: number
  errors?: Array<{
    index: number
    message: string
  }>
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
