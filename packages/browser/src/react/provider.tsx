import { type ReactNode, createContext, useCallback, useEffect, useRef, useState } from "react"
import { Outlit, type OutlitOptions, type UserIdentity } from "../tracker"

// ============================================
// CONTEXT
// ============================================

export interface OutlitContextValue {
  outlit: Outlit | null
  isInitialized: boolean
  isTrackingEnabled: boolean
  enableTracking: () => void
}

export const OutlitContext = createContext<OutlitContextValue>({
  outlit: null,
  isInitialized: false,
  isTrackingEnabled: false,
  enableTracking: () => {},
})

// ============================================
// PROVIDER
// ============================================

export interface OutlitProviderProps extends Omit<OutlitOptions, "trackPageviews"> {
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
  /**
   * Current user identity.
   * When provided with email or userId, calls setUser() to identify the user.
   * When null, undefined, or missing identity fields, calls clearUser().
   *
   * This is the recommended way to handle user identity in server-rendered apps:
   * pass the user from your auth system as a prop.
   *
   * @example
   * ```tsx
   * // Server component (layout.tsx)
   * const session = await auth()
   * return (
   *   <OutlitProvider
   *     publicKey="pk_xxx"
   *     user={session?.user ? { email: session.user.email, userId: session.user.id } : null}
   *   >
   *     {children}
   *   </OutlitProvider>
   * )
   * ```
   */
  user?: UserIdentity | null
}

/**
 * Outlit Provider component.
 * Initializes the client and provides it to child components via context.
 *
 * @example
 * ```tsx
 * // layout.tsx - Auto tracking (default)
 * import { OutlitProvider } from '@outlit/browser/react'
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
 * import { OutlitProvider } from '@outlit/browser/react'
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
 * import { useOutlit } from '@outlit/browser/react'
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
  user,
}: OutlitProviderProps) {
  const outlitRef = useRef<Outlit | null>(null)
  const initializedRef = useRef(false)
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false)

  // Initialize Outlit once
  useEffect(() => {
    if (initializedRef.current) return

    outlitRef.current = new Outlit({
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
    setIsTrackingEnabled(outlitRef.current.isEnabled())

    // Cleanup on unmount
    return () => {
      outlitRef.current?.shutdown()
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

  // Handle user prop changes (login/logout)
  useEffect(() => {
    if (!outlitRef.current) return

    if (user && (user.email || user.userId)) {
      // User is logged in - set user identity (pass full object to include traits)
      outlitRef.current.setUser(user)
    } else {
      // User logged out (null/undefined) or has no valid identity - clear
      outlitRef.current.clearUser()
    }
  }, [user])

  const enableTracking = useCallback(() => {
    if (outlitRef.current) {
      outlitRef.current.enableTracking()
      setIsTrackingEnabled(true)
    }
  }, [])

  return (
    <OutlitContext.Provider
      value={{
        outlit: outlitRef.current,
        isInitialized: initializedRef.current,
        isTrackingEnabled,
        enableTracking,
      }}
    >
      {children}
    </OutlitContext.Provider>
  )
}
