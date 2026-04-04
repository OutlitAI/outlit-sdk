// Types

// Payload builders
export {
  batchEvents,
  buildBillingEvent,
  buildCalendarEvent,
  buildCustomEvent,
  buildEngagementEvent,
  buildFormEvent,
  buildIdentifyEvent,
  buildIngestPayload,
  buildPageviewEvent,
  buildStageEvent,
  MAX_BATCH_SIZE,
} from "./payload"
export type {
  BillingEvent,
  BillingStatus,
  BrowserIdentifyOptions,
  BrowserTrackOptions,
  CalendarEvent,
  CalendarProvider,
  CustomEvent,
  CustomerAttribution,
  CustomerIdentifier,
  CustomerTraits,
  EngagementEvent,
  EventType,
  ExplicitJourneyStage,
  FormEvent,
  IdentifyEvent,
  IdentifyTraits,
  IngestPayload,
  IngestResponse,
  PageviewEvent,
  PayloadUserIdentity,
  ServerIdentifyOptions,
  ServerIdentity,
  ServerTrackOptions,
  SourceType,
  StageEvent,
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
  validateCustomerIdentity,
  validateServerIdentity,
} from "./utils"
