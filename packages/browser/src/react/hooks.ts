import type { BrowserIdentifyOptions, BrowserTrackOptions } from "@outlit/core"
import { useCallback, useContext } from "react"
import type { BillingOptions, UserIdentity } from "../tracker"
import { OutlitContext } from "./provider"

// ============================================
// useOutlit Hook
// ============================================

export interface UseOutlitReturn {
  /**
   * Track a custom event.
   */
  track: (eventName: string, properties?: BrowserTrackOptions["properties"]) => void

  /**
   * Identify the current visitor.
   * Links the anonymous visitor to a known user.
   */
  identify: (options: BrowserIdentifyOptions) => void

  /**
   * Get the current visitor ID.
   * Returns null if tracking is not enabled.
   */
  getVisitorId: () => string | null

  /**
   * Set the current user identity.
   * Use this for persistent identity after login.
   */
  setUser: (identity: UserIdentity) => void

  /**
   * Clear the current user identity (on logout).
   */
  clearUser: () => void

  /**
   * User namespace methods for contact journey stages.
   */
  user: {
    identify: (options: BrowserIdentifyOptions) => void
    activate: (properties?: Record<string, string | number | boolean | null>) => void
    engaged: (properties?: Record<string, string | number | boolean | null>) => void
    inactive: (properties?: Record<string, string | number | boolean | null>) => void
  }

  /**
   * Customer namespace methods for billing status.
   */
  customer: {
    trialing: (options: BillingOptions) => void
    paid: (options: BillingOptions) => void
    churned: (options: BillingOptions) => void
  }

  /**
   * Whether Outlit is initialized.
   */
  isInitialized: boolean

  /**
   * Whether tracking is currently enabled.
   * Will be false if autoTrack is false and enableTracking() hasn't been called.
   */
  isTrackingEnabled: boolean

  /**
   * Enable tracking. Call this after obtaining user consent.
   * Only needed if you initialized with autoTrack: false.
   */
  enableTracking: () => void
}

/**
 * Hook to access the Outlit client.
 *
 * @example
 * ```tsx
 * import { useOutlit } from '@outlit/browser/react'
 *
 * function MyComponent() {
 *   const { track, user } = useOutlit()
 *
 *   return (
 *     <button onClick={() => user.activate({ milestone: 'onboarding_complete' })}>
 *       Click me
 *     </button>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With consent management
 * function ConsentBanner() {
 *   const { enableTracking, isTrackingEnabled } = useOutlit()
 *
 *   if (isTrackingEnabled) return null
 *
 *   return (
 *     <div>
 *       <p>We use cookies to improve your experience.</p>
 *       <button onClick={enableTracking}>Accept</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useOutlit(): UseOutlitReturn {
  const { outlit, isInitialized, isTrackingEnabled, enableTracking } = useContext(OutlitContext)

  const track = useCallback(
    (eventName: string, properties?: BrowserTrackOptions["properties"]) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.track(eventName, properties)
    },
    [outlit],
  )

  const identify = useCallback(
    (options: BrowserIdentifyOptions) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.identify(options)
    },
    [outlit],
  )

  const userIdentify = useCallback(
    (options: BrowserIdentifyOptions) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.user.identify(options)
    },
    [outlit],
  )

  const getVisitorId = useCallback(() => {
    if (!outlit) return null
    return outlit.getVisitorId()
  }, [outlit])

  const setUser = useCallback(
    (identity: UserIdentity) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.setUser(identity)
    },
    [outlit],
  )

  const clearUser = useCallback(() => {
    if (!outlit) {
      console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
      return
    }
    outlit.clearUser()
  }, [outlit])

  const activate = useCallback(
    (properties?: Record<string, string | number | boolean | null>) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.user.activate(properties)
    },
    [outlit],
  )

  const engaged = useCallback(
    (properties?: Record<string, string | number | boolean | null>) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.user.engaged(properties)
    },
    [outlit],
  )

  const inactive = useCallback(
    (properties?: Record<string, string | number | boolean | null>) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.user.inactive(properties)
    },
    [outlit],
  )

  const trialing = useCallback(
    (options: BillingOptions) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.customer.trialing(options)
    },
    [outlit],
  )

  const paid = useCallback(
    (options: BillingOptions) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.customer.paid(options)
    },
    [outlit],
  )

  const churned = useCallback(
    (options: BillingOptions) => {
      if (!outlit) {
        console.warn("[Outlit] Not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      outlit.customer.churned(options)
    },
    [outlit],
  )

  return {
    track,
    identify,
    getVisitorId,
    setUser,
    clearUser,
    user: {
      identify: userIdentify,
      activate,
      engaged,
      inactive,
    },
    customer: {
      trialing,
      paid,
      churned,
    },
    isInitialized,
    isTrackingEnabled,
    enableTracking,
  }
}

// ============================================
// useTrack Hook (convenience)
// ============================================

/**
 * Convenience hook that returns just the track function.
 *
 * @example
 * ```tsx
 * import { useTrack } from '@outlit/browser/react'
 *
 * function MyComponent() {
 *   const track = useTrack()
 *   return <button onClick={() => track('clicked')}>Click</button>
 * }
 * ```
 */
export function useTrack() {
  const { track } = useOutlit()
  return track
}

// ============================================
// useIdentify Hook (convenience)
// ============================================

/**
 * Convenience hook that returns just the identify function.
 *
 * @example
 * ```tsx
 * import { useIdentify } from '@outlit/browser/react'
 *
 * function LoginForm() {
 *   const identify = useIdentify()
 *
 *   const onLogin = (user) => {
 *     identify({ email: user.email, traits: { name: user.name } })
 *   }
 * }
 * ```
 */
export function useIdentify() {
  const { identify } = useOutlit()
  return identify
}
