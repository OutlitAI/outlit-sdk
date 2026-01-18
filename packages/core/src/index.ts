// Types
export type {
  EventType,
  SourceType,
  CalendarProvider,
  UtmParams,
  TrackerConfig,
  BrowserTrackOptions,
  BrowserIdentifyOptions,
  ServerTrackOptions,
  ServerIdentifyOptions,
  ServerIdentity,
  CustomerIdentifier,
  PageviewEvent,
  FormEvent,
  IdentifyEvent,
  CustomEvent,
  CalendarEvent,
  EngagementEvent,
  StageEvent,
  BillingEvent,
  BillingStatus,
  ExplicitJourneyStage,
  TrackerEvent,
  IngestPayload,
  IngestResponse,
  PayloadUserIdentity,
} from "./types"

// Constants
export { DEFAULT_API_HOST, DEFAULT_DENIED_FORM_FIELDS } from "./types"

// Utilities
export {
  extractUtmParams,
  extractPathFromUrl,
  isFieldDenied,
  sanitizeFormFields,
  validateServerIdentity,
  // Auto-identify utilities
  isValidEmail,
  findEmailField,
  findNameFields,
  extractIdentityFromForm,
} from "./utils"

// Auto-identify types
export type { ExtractedIdentity } from "./utils"

// Payload builders
export {
  buildPageviewEvent,
  buildFormEvent,
  buildIdentifyEvent,
  buildCustomEvent,
  buildCalendarEvent,
  buildEngagementEvent,
  buildStageEvent,
  buildBillingEvent,
  buildIngestPayload,
  batchEvents,
  MAX_BATCH_SIZE,
} from "./payload"
