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
  disableTracking: () => void
}

export const OutlitContext = createContext<OutlitContextValue>({
  outlit: null,
  isInitialized: false,
  isTrackingEnabled: false,
  enableTracking: () => {},
  disableTracking: () => {},
})

// ============================================
// PROVIDER PROPS
// ============================================

interface OutlitProviderBaseProps {
  children: ReactNode
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
 * Props for using a pre-existing Outlit instance.
 * The provider will use this instance directly without creating a new one.
 * The caller owns the instance lifecycle — shutdown() will NOT be called on unmount.
 *
 * @example
 * ```tsx
 * import { Outlit } from '@outlit/browser'
 * import { OutlitProvider } from '@outlit/browser/react'
 *
 * const outlit = new Outlit({ publicKey: 'pk_xxx', trackPageviews: false })
 *
 * function App() {
 *   const user = useAuth()
 *   return (
 *     <OutlitProvider client={outlit} user={user ? { email: user.email } : null}>
 *       {children}
 *     </OutlitProvider>
 *   )
 * }
 * ```
 */
type NeverOutlitOptions = { [K in keyof OutlitOptions]?: never }

interface OutlitProviderClientProps extends OutlitProviderBaseProps, NeverOutlitOptions {
  /** An existing Outlit instance to use. Config props are ignored when this is provided. */
  client: Outlit
}

/**
 * Props for creating a new Outlit instance internally.
 * This is the default behavior — the provider creates and owns the instance.
 */
interface OutlitProviderConfigProps
  extends OutlitProviderBaseProps,
    Omit<OutlitOptions, "trackPageviews"> {
  client?: never
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

export type OutlitProviderProps = OutlitProviderClientProps | OutlitProviderConfigProps

// ============================================
// PROVIDER
// ============================================

/**
 * Outlit Provider component.
 * Initializes the client and provides it to child components via context.
 *
 * Can be used in two ways:
 *
 * 1. **Config mode** (default): Pass `publicKey` and config options to create a new instance.
 * 2. **Client mode**: Pass an existing `client` instance for shared imperative + React usage.
 *
 * @example
 * ```tsx
 * // Config mode — provider creates and owns the instance
 * <OutlitProvider publicKey="pk_xxx" trackPageviews>
 *   {children}
 * </OutlitProvider>
 * ```
 *
 * @example
 * ```tsx
 * // Client mode — use an existing instance
 * const outlit = new Outlit({ publicKey: 'pk_xxx' })
 * outlit.track('pageview') // imperative usage
 *
 * <OutlitProvider client={outlit} user={user}>
 *   {children}
 * </OutlitProvider>
 * ```
 */
export function OutlitProvider(props: OutlitProviderProps) {
  const { children, user } = props

  const outlitRef = useRef<Outlit | null>(null)
  const initializedRef = useRef(false)
  const isExternalClientRef = useRef(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false)

  // Initialize Outlit once (guarded by initializedRef to run exactly once)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once on mount — initializedRef guard prevents re-execution
  useEffect(() => {
    if (initializedRef.current) return

    if (props.client) {
      // Client mode: use the provided instance
      if (process.env.NODE_ENV !== "production") {
        const configKeys = [
          "publicKey",
          "apiHost",
          "trackPageviews",
          "trackForms",
          "formFieldDenylist",
          "flushInterval",
          "autoTrack",
          "autoIdentify",
          "trackCalendarEmbeds",
          "trackEngagement",
          "idleTimeout",
        ] as const
        const conflicting = configKeys.filter(
          (k) => k in props && (props as unknown as Record<string, unknown>)[k] !== undefined,
        )
        if (conflicting.length > 0) {
          console.warn(
            `[Outlit] Both \`client\` and config props (${conflicting.join(", ")}) were provided to OutlitProvider. The \`client\` instance will be used and config props will be ignored.`,
          )
        }
      }
      outlitRef.current = props.client
      isExternalClientRef.current = true
    } else {
      // Config mode: create a new instance
      const {
        publicKey,
        apiHost,
        trackPageviews = true,
        trackForms = true,
        formFieldDenylist,
        flushInterval,
        autoTrack = true,
        autoIdentify = true,
        trackCalendarEmbeds,
        trackEngagement,
        idleTimeout,
      } = props
      outlitRef.current = new Outlit({
        publicKey,
        apiHost,
        trackPageviews,
        trackForms,
        formFieldDenylist,
        flushInterval,
        autoTrack,
        autoIdentify,
        trackCalendarEmbeds,
        trackEngagement,
        idleTimeout,
      })
    }

    initializedRef.current = true
    setIsInitialized(true)
    setIsTrackingEnabled(outlitRef.current.isEnabled())

    // Cleanup on unmount — only shutdown instances we created
    return () => {
      if (!isExternalClientRef.current) {
        outlitRef.current?.shutdown()
      }
    }
  }, [])

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

  const disableTracking = useCallback(() => {
    if (outlitRef.current) {
      outlitRef.current.disableTracking()
      setIsTrackingEnabled(false)
    }
  }, [])

  return (
    <OutlitContext.Provider
      value={{
        outlit: outlitRef.current,
        isInitialized,
        isTrackingEnabled,
        enableTracking,
        disableTracking,
      }}
    >
      {children}
    </OutlitContext.Provider>
  )
}
