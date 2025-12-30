// Main exports for npm package
export {
  Outlit,
  init,
  getInstance,
  track,
  identify,
  enableTracking,
  isTrackingEnabled,
  setUser,
  clearUser,
  activate,
  engaged,
  paid,
  churned,
} from "./tracker"
export type { OutlitOptions, UserIdentity } from "./tracker"

// Re-export useful types from core
export type {
  BrowserTrackOptions,
  BrowserIdentifyOptions,
  TrackerConfig,
  UtmParams,
  ExplicitJourneyStage,
} from "@outlit/core"

// Default export for simple import
import {
  Outlit,
  activate,
  churned,
  clearUser,
  enableTracking,
  engaged,
  getInstance,
  identify,
  init,
  isTrackingEnabled,
  paid,
  setUser,
  track,
} from "./tracker"

export default {
  init,
  track,
  identify,
  getInstance,
  Outlit,
  enableTracking,
  isTrackingEnabled,
  setUser,
  clearUser,
  activate,
  engaged,
  paid,
  churned,
}
