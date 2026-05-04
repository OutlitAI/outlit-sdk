// Main export

// Re-export useful types from core
export type {
  ExplicitJourneyStage,
  IngestResponse,
  ServerIdentifyOptions,
  ServerTrackOptions,
  TrackerConfig,
} from "@outlit/core"
export type { BillingOptions, OutlitOptions, StageOptions, UserMethods } from "./client"
export { Outlit } from "./client"
