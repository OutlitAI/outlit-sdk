// Main exports for npm package
export {
  Tracker,
  init,
  getInstance,
  track,
  identify,
  enableTracking,
  isTrackingEnabled,
} from "./tracker"
export type { TrackerOptions } from "./tracker"

// Re-export useful types from core
export type {
  BrowserTrackOptions,
  BrowserIdentifyOptions,
  TrackerConfig,
  UtmParams,
} from "@outlit/core"

// Default export for simple import
import {
  Tracker,
  enableTracking,
  getInstance,
  identify,
  init,
  isTrackingEnabled,
  track,
} from "./tracker"

export default {
  init,
  track,
  identify,
  getInstance,
  Tracker,
  enableTracking,
  isTrackingEnabled,
}
