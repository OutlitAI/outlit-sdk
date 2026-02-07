// Main exports for npm package
export {
  Outlit,
  init,
  getInstance,
  track,
  identify,
  enableTracking,
  disableTracking,
  isTrackingEnabled,
  setUser,
  clearUser,
  user,
  customer,
} from "./tracker"
export type { OutlitOptions, UserIdentity, BillingOptions } from "./tracker"

// Re-export useful types from core
export type {
  BrowserTrackOptions,
  BrowserIdentifyOptions,
  TrackerConfig,
  UtmParams,
  ExplicitJourneyStage,
  CustomerIdentifier,
} from "@outlit/core"

// Default export for simple import
import {
  Outlit,
  clearUser,
  customer,
  disableTracking,
  enableTracking,
  getInstance,
  identify,
  init,
  isTrackingEnabled,
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
  customer,
}
