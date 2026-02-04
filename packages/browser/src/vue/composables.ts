import type { BrowserIdentifyOptions, BrowserTrackOptions } from "@outlit/core"
import { type Ref, inject, watch } from "vue"
import type { BillingOptions, UserIdentity } from "../tracker"
import { type OutlitInstance, OutlitKey } from "./plugin"

// ============================================
// useOutlit Composable
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
   * Automatically calls identify().
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
  isInitialized: Ref<boolean>

  /**
   * Whether tracking is currently enabled.
   */
  isTrackingEnabled: Ref<boolean>

  /**
   * Enable tracking. Call this after obtaining user consent.
   */
  enableTracking: () => void
}

/**
 * Composable to access the Outlit client.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useOutlit } from '@outlit/browser/vue'
 *
 * const { track, user } = useOutlit()
 *
 * const handleClick = () => {
 *   user.activate({ milestone: 'onboarding_complete' })
 * }
 * </script>
 * ```
 */
export function useOutlit(): UseOutlitReturn {
  const instance = inject(OutlitKey)

  if (!instance) {
    throw new Error("[Outlit] Not initialized. Make sure to install OutlitPlugin in your Vue app.")
  }

  const { outlit, isInitialized, isTrackingEnabled, enableTracking } = instance

  const track = (eventName: string, properties?: BrowserTrackOptions["properties"]) => {
    if (!outlit.value) {
      console.warn("[Outlit] Not initialized.")
      return
    }
    outlit.value.track(eventName, properties)
  }

  const identify = (options: BrowserIdentifyOptions) => {
    if (!outlit.value) {
      console.warn("[Outlit] Not initialized.")
      return
    }
    outlit.value.identify(options)
  }

  const getVisitorId = () => {
    if (!outlit.value) return null
    return outlit.value.getVisitorId()
  }

  const setUser = (identity: UserIdentity) => {
    if (!outlit.value) {
      console.warn("[Outlit] Not initialized.")
      return
    }
    outlit.value.setUser(identity)
  }

  const clearUser = () => {
    if (!outlit.value) {
      console.warn("[Outlit] Not initialized.")
      return
    }
    outlit.value.clearUser()
  }

  return {
    track,
    identify,
    getVisitorId,
    setUser,
    clearUser,
    user: {
      identify: (options: BrowserIdentifyOptions) => outlit.value?.user.identify(options),
      activate: (properties) => outlit.value?.user.activate(properties),
      engaged: (properties) => outlit.value?.user.engaged(properties),
      inactive: (properties) => outlit.value?.user.inactive(properties),
    },
    customer: {
      trialing: (options: BillingOptions) => outlit.value?.customer.trialing(options),
      paid: (options: BillingOptions) => outlit.value?.customer.paid(options),
      churned: (options: BillingOptions) => outlit.value?.customer.churned(options),
    },
    isInitialized,
    isTrackingEnabled,
    enableTracking,
  }
}

// ============================================
// useTrack Composable (convenience)
// ============================================

/**
 * Convenience composable that returns just the track function.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useTrack } from '@outlit/browser/vue'
 *
 * const track = useTrack()
 * </script>
 *
 * <template>
 *   <button @click="track('button_clicked')">Click me</button>
 * </template>
 * ```
 */
export function useTrack() {
  const { track } = useOutlit()
  return track
}

// ============================================
// useIdentify Composable (convenience)
// ============================================

/**
 * Convenience composable that returns just the identify function.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useIdentify } from '@outlit/browser/vue'
 *
 * const identify = useIdentify()
 *
 * const onLogin = (user) => {
 *   identify({ email: user.email, traits: { name: user.name } })
 * }
 * </script>
 * ```
 */
export function useIdentify() {
  const { identify } = useOutlit()
  return identify
}

// ============================================
// useOutlitUser Composable (auto-identify)
// ============================================

/**
 * Composable that automatically syncs a reactive user ref with Outlit.
 * When the user ref changes, it automatically calls setUser() or clearUser().
 *
 * This is the recommended way to handle auth state in Vue apps.
 *
 * @example
 * ```vue
 * <script setup>
 * import { ref } from 'vue'
 * import { useOutlitUser } from '@outlit/browser/vue'
 *
 * // Your auth state
 * const currentUser = ref(null)
 *
 * // Auto-sync with Outlit
 * useOutlitUser(currentUser)
 *
 * // When user logs in
 * const onLogin = (user) => {
 *   currentUser.value = {
 *     email: user.email,
 *     userId: user.id,
 *     traits: { name: user.name, plan: user.plan }
 *   }
 * }
 *
 * // When user logs out
 * const onLogout = () => {
 *   currentUser.value = null
 * }
 * </script>
 * ```
 */
export function useOutlitUser(userRef: Ref<UserIdentity | null | undefined>) {
  const instance = inject(OutlitKey)

  if (!instance) {
    throw new Error("[Outlit] Not initialized. Make sure to install OutlitPlugin in your Vue app.")
  }

  const { outlit } = instance

  // Watch the user ref and auto-sync
  watch(
    userRef,
    (user: UserIdentity | null | undefined) => {
      if (!outlit.value) return

      if (user && (user.email || user.userId)) {
        outlit.value.setUser(user)
      } else {
        outlit.value.clearUser()
      }
    },
    { immediate: true },
  )
}

// ============================================
// Type Aliases (VueUse convention)
// ============================================

/**
 * Return type of useTrack composable
 */
export type UseTrackReturn = ReturnType<typeof useTrack>

/**
 * Return type of useIdentify composable
 */
export type UseIdentifyReturn = ReturnType<typeof useIdentify>
