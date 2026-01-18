/**
 * Global type declarations for Outlit SDK E2E tests.
 *
 * This file extends the Window interface to include the `window.outlit` global
 * that is created by the SDK when loaded via script tag.
 *
 * Note: Some properties (_instance, _loaded, _q) are internal and used for testing only.
 */

import type { Outlit } from "../../src/tracker"

declare global {
  interface Window {
    outlit: {
      // Public API
      init: (options: { publicKey: string; apiHost?: string }) => void
      track: (eventName: string, properties?: Record<string, unknown>) => void
      identify: (options: {
        email?: string
        userId?: string
        traits?: Record<string, unknown>
      }) => void
      getVisitorId: () => string | null
      enableTracking: () => void
      isTrackingEnabled: () => boolean
      setUser: (identity: {
        email?: string
        userId?: string
        traits?: Record<string, string | number | boolean | null>
      }) => void
      clearUser: () => void
      user: {
        identify: (options: {
          email?: string
          userId?: string
          traits?: Record<string, unknown>
        }) => void
        activate: (properties?: Record<string, unknown>) => void
        engaged: (properties?: Record<string, unknown>) => void
        inactive: (properties?: Record<string, unknown>) => void
      }
      customer: {
        trialing: (options: {
          domain?: string
          customerId?: string
          stripeCustomerId?: string
          properties?: Record<string, unknown>
        }) => void
        paid: (options: {
          domain?: string
          customerId?: string
          stripeCustomerId?: string
          properties?: Record<string, unknown>
        }) => void
        churned: (options: {
          domain?: string
          customerId?: string
          stripeCustomerId?: string
          properties?: Record<string, unknown>
        }) => void
      }

      // Internal properties (for testing)
      _initialized: boolean
      _instance: Outlit | null
      _loaded?: boolean
      _q?: Array<[string, unknown[]]> // Stub queue before SDK loads
      _queue?: Array<() => void> // Post-init queue
    }
  }
}
