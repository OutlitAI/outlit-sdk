// Main export
export { Outlit } from "./client"
export type { OutlitOptions, StageOptions } from "./client"

// Re-export useful types from core
export type {
  ServerTrackOptions,
  ServerIdentifyOptions,
  TrackerConfig,
  IngestResponse,
  ExplicitJourneyStage,
} from "@outlit/core"
