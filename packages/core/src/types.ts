// ============================================
// EVENT TYPES
// ============================================

export type EventType = "pageview" | "form" | "identify" | "custom"

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
  traits?: Record<string, string | number | boolean | null>
}

// ============================================
// SERVER-SPECIFIC TYPES (identity required)
// No anonymous tracking - must identify the user
// ============================================

export interface ServerTrackOptions {
  email?: string // At least one of email/userId required
  userId?: string // At least one of email/userId required
  eventName: string
  properties?: Record<string, string | number | boolean | null>
  timestamp?: number
}

export interface ServerIdentifyOptions {
  email?: string // At least one of email/userId required
  userId?: string // At least one of email/userId required
  traits?: Record<string, string | number | boolean | null>
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
  traits?: Record<string, string | number | boolean | null>
}

export interface CustomEvent extends BaseEvent {
  type: "custom"
  eventName: string
  properties?: Record<string, string | number | boolean | null>
}

export type TrackerEvent = PageviewEvent | FormEvent | IdentifyEvent | CustomEvent

// ============================================
// INGEST PAYLOAD
// This is what gets sent to the API
// ============================================

export interface IngestPayload {
  visitorId?: string // Required for pixel, optional for server
  source: SourceType
  events: TrackerEvent[]
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
