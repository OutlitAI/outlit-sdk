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
  PageviewEvent,
  FormEvent,
  IdentifyEvent,
  CustomEvent,
  CalendarEvent,
  TrackerEvent,
  IngestPayload,
  IngestResponse,
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
  buildIngestPayload,
  batchEvents,
  MAX_BATCH_SIZE,
} from "./payload"
