// Main exports for npm package

// Re-export useful types from core
export type {
  BrowserIdentifyOptions,
  BrowserTrackOptions,
  CustomerIdentifier,
  ExplicitJourneyStage,
  TrackerConfig,
  UtmParams,
} from "@outlit/core"
export type { BillingOptions, OutlitOptions, UserIdentity } from "./tracker"
export {
  clearUser,
  customer,
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
  customer,
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
  customer,
}
