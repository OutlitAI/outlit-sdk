// Types

// Payload builders
export {
  batchEvents,
  buildCalendarEvent,
  buildCustomEvent,
  buildEngagementEvent,
  buildFormEvent,
  buildIdentifyEvent,
  buildIngestPayload,
  buildPageviewEvent,
  MAX_BATCH_SIZE,
} from "./payload"
export type {
  BrowserIdentifyOptions,
  BrowserTrackOptions,
  CalendarEvent,
  CalendarProvider,
  CustomEvent,
  CustomerAttribution,
  CustomerTraits,
  EngagementEvent,
  EventType,
  FormEvent,
  IdentifyEvent,
  IdentifyTraits,
  IngestPayload,
  IngestResponse,
  PageviewEvent,
  PayloadCustomerIdentity,
  PayloadUserIdentity,
  ServerIdentifyOptions,
  ServerIdentity,
  ServerTrackOptions,
  SourceType,
  TrackerConfig,
  TrackerEvent,
  UtmParams,
} from "./types"
// Constants
export { DEFAULT_API_HOST, DEFAULT_DENIED_FORM_FIELDS } from "./types"

// Auto-identify types
export type { ExtractedIdentity } from "./utils"
// Utilities
export {
  extractIdentityFromForm,
  extractPathFromUrl,
  extractUtmParams,
  findEmailField,
  findNameFields,
  isFieldDenied,
  // Auto-identify utilities
  isValidEmail,
  sanitizeFormFields,
  validateServerIdentity,
} from "./utils"
