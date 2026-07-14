// Main exports for npm package

// Re-export useful types from core
export type {
  BrowserIdentifyOptions,
  BrowserTrackOptions,
  TrackerConfig,
  UtmParams,
} from "@outlit/core"
export type { OutlitOptions, UserIdentity, UserMethods } from "./tracker"
export {
  clearUser,
  disableTracking,
  enableTracking,
  getInstance,
  identify,
  init,
  isTrackingEnabled,
  Outlit,
  setUser,
  track,
  user,
} from "./tracker"

// Default export for simple import
import {
  clearUser,
  disableTracking,
  enableTracking,
  getInstance,
  identify,
  init,
  isTrackingEnabled,
  Outlit,
  setUser,
  track,
  user,
} from "./tracker"

export default {
  init,
  track,
  identify,
  getInstance,
  Outlit,
  enableTracking,
  disableTracking,
  isTrackingEnabled,
  setUser,
  clearUser,
  user,
}
