// Provider
export { OutlitProvider, OutlitContext } from "./provider"
export type { OutlitProviderProps, OutlitContextValue } from "./provider"

// Hooks
export { useOutlit, useTrack, useIdentify } from "./hooks"
export type { UseOutlitReturn } from "./hooks"

// Re-export useful types from tracker
export type { UserIdentity } from "../tracker"

// Re-export useful types from core for convenience
export type {
  BrowserTrackOptions,
  BrowserIdentifyOptions,
  TrackerConfig,
  ExplicitJourneyStage,
} from "@outlit/core"
