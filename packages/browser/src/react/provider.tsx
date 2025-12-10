import { type ReactNode, createContext, useCallback, useEffect, useRef, useState } from "react"
import { Tracker, type TrackerOptions } from "../tracker"

// ============================================
// CONTEXT
// ============================================

export interface OutlitContextValue {
  tracker: Tracker | null
  isInitialized: boolean
  isTrackingEnabled: boolean
  enableTracking: () => void
}

export const OutlitContext = createContext<OutlitContextValue>({
  tracker: null,
  isInitialized: false,
  isTrackingEnabled: false,
  enableTracking: () => {},
})

// ============================================
// PROVIDER
// ============================================

export interface OutlitProviderProps extends Omit<TrackerOptions, "trackPageviews"> {
  children: ReactNode
  /**
   * Whether to automatically track pageviews.
   * When true (default), tracks pageviews on route changes.
   */
  trackPageviews?: boolean
  /**
   * Whether to start tracking automatically on mount.
   * Set to false if you need to wait for user consent.
   * Call enableTracking() (from useOutlit hook) after consent is obtained.
   * @default true
   */
  autoTrack?: boolean
}

/**
 * Outlit Provider component.
 * Initializes the tracker and provides it to child components via context.
 *
 * @example
 * ```tsx
 * // layout.tsx - Auto tracking (default)
 * import { OutlitProvider } from '@outlit/tracker/react'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <OutlitProvider publicKey="pk_xxx" trackPageviews>
 *       {children}
 *     </OutlitProvider>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // layout.tsx - With consent management
 * import { OutlitProvider } from '@outlit/tracker/react'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <OutlitProvider publicKey="pk_xxx" autoTrack={false}>
 *       {children}
 *     </OutlitProvider>
 *   )
 * }
 *
 * // ConsentBanner.tsx
 * import { useOutlit } from '@outlit/tracker/react'
 *
 * function ConsentBanner() {
 *   const { enableTracking } = useOutlit()
 *   return <button onClick={enableTracking}>Accept Cookies</button>
 * }
 * ```
 */
export function OutlitProvider({
  children,
  publicKey,
  apiHost,
  trackPageviews = true,
  trackForms = true,
  formFieldDenylist,
  flushInterval,
  autoTrack = true,
  autoIdentify = true,
}: OutlitProviderProps) {
  const trackerRef = useRef<Tracker | null>(null)
  const initializedRef = useRef(false)
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false)

  // Initialize tracker once
  useEffect(() => {
    if (initializedRef.current) return

    trackerRef.current = new Tracker({
      publicKey,
      apiHost,
      trackPageviews,
      trackForms,
      formFieldDenylist,
      flushInterval,
      autoTrack,
      autoIdentify,
    })

    initializedRef.current = true
    setIsTrackingEnabled(trackerRef.current.isEnabled())

    // Cleanup on unmount
    return () => {
      trackerRef.current?.shutdown()
    }
  }, [
    publicKey,
    apiHost,
    trackPageviews,
    trackForms,
    formFieldDenylist,
    flushInterval,
    autoTrack,
    autoIdentify,
  ])

  const enableTracking = useCallback(() => {
    if (trackerRef.current) {
      trackerRef.current.enableTracking()
      setIsTrackingEnabled(true)
    }
  }, [])

  return (
    <OutlitContext.Provider
      value={{
        tracker: trackerRef.current,
        isInitialized: initializedRef.current,
        isTrackingEnabled,
        enableTracking,
      }}
    >
      {children}
    </OutlitContext.Provider>
  )
}
