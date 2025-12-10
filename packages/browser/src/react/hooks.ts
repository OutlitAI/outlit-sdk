import type { BrowserIdentifyOptions, BrowserTrackOptions } from "@outlit/core"
import { useCallback, useContext } from "react"
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
   * Whether the tracker is initialized.
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
 * Hook to access the Outlit tracker.
 *
 * @example
 * ```tsx
 * import { useOutlit } from '@outlit/tracker/react'
 *
 * function MyComponent() {
 *   const { track, identify } = useOutlit()
 *
 *   return (
 *     <button onClick={() => track('button_clicked', { id: 'cta' })}>
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
  const { tracker, isInitialized, isTrackingEnabled, enableTracking } = useContext(OutlitContext)

  const track = useCallback(
    (eventName: string, properties?: BrowserTrackOptions["properties"]) => {
      if (!tracker) {
        console.warn("[Outlit] Tracker not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      tracker.track(eventName, properties)
    },
    [tracker],
  )

  const identify = useCallback(
    (options: BrowserIdentifyOptions) => {
      if (!tracker) {
        console.warn("[Outlit] Tracker not initialized. Make sure OutlitProvider is mounted.")
        return
      }
      tracker.identify(options)
    },
    [tracker],
  )

  const getVisitorId = useCallback(() => {
    if (!tracker) return null
    return tracker.getVisitorId()
  }, [tracker])

  return {
    track,
    identify,
    getVisitorId,
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
 * import { useTrack } from '@outlit/tracker/react'
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
 * import { useIdentify } from '@outlit/tracker/react'
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
