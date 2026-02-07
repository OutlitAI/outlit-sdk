import type { App, InjectionKey, Ref, ShallowRef } from "vue"
import { readonly, ref, shallowRef, watch } from "vue"
import { Outlit, type OutlitOptions, type UserIdentity } from "../tracker"

// ============================================
// TYPES
// ============================================

export interface OutlitPluginOptions extends Omit<OutlitOptions, "trackPageviews"> {
  /**
   * Whether to automatically track pageviews.
   * @default true
   */
  trackPageviews?: boolean
  /**
   * Whether to start tracking automatically.
   * Set to false if you need to wait for user consent.
   * @default true
   */
  autoTrack?: boolean
}

export interface OutlitInstance {
  outlit: ShallowRef<Outlit | null>
  isInitialized: Readonly<Ref<boolean>>
  isTrackingEnabled: Readonly<Ref<boolean>>
  enableTracking: () => void
  disableTracking: () => void
  /**
   * Set the current user. Automatically calls identify when user changes.
   * Pass null to clear the user (logout).
   */
  setUser: (user: UserIdentity | null) => void
}

// ============================================
// INJECTION KEY
// ============================================

export const OutlitKey: InjectionKey<OutlitInstance> = Symbol("outlit")

// ============================================
// PLUGIN
// ============================================

/**
 * Vue plugin to install Outlit.
 *
 * @example
 * ```ts
 * // main.ts
 * import { createApp } from 'vue'
 * import { OutlitPlugin } from '@outlit/browser/vue'
 *
 * const app = createApp(App)
 * app.use(OutlitPlugin, { publicKey: 'pk_xxx' })
 * app.mount('#app')
 * ```
 */
export const OutlitPlugin = {
  install(app: App, options: OutlitPluginOptions) {
    const outlitRef = shallowRef<Outlit | null>(null)
    const isInitialized = ref(false)
    const isTrackingEnabled = ref(false)
    const currentUser = ref<UserIdentity | null>(null)

    // Initialize Outlit - forward all options with defaults
    const {
      trackPageviews = true,
      trackForms = true,
      autoTrack = true,
      autoIdentify = true,
      ...rest
    } = options

    outlitRef.value = new Outlit({
      ...rest,
      trackPageviews,
      trackForms,
      autoTrack,
      autoIdentify,
    })

    isInitialized.value = true
    isTrackingEnabled.value = outlitRef.value.isEnabled()

    const enableTracking = () => {
      if (outlitRef.value) {
        outlitRef.value.enableTracking()
        isTrackingEnabled.value = true
      }
    }

    const disableTracking = () => {
      if (outlitRef.value) {
        outlitRef.value.disableTracking()
        isTrackingEnabled.value = false
      }
    }

    const setUser = (user: UserIdentity | null) => {
      currentUser.value = user
    }

    // Watch for user changes and auto-identify
    watch(
      currentUser,
      (user) => {
        if (!outlitRef.value) return

        if (user && (user.email || user.userId)) {
          outlitRef.value.setUser(user)
        } else {
          outlitRef.value.clearUser()
        }
      },
      { immediate: true },
    )

    // Provide to all components
    // Note: Don't use readonly() on outlitRef - the Outlit class needs to mutate its internal state
    app.provide(OutlitKey, {
      outlit: outlitRef,
      isInitialized: readonly(isInitialized),
      isTrackingEnabled: readonly(isTrackingEnabled),
      enableTracking,
      disableTracking,
      setUser,
    })

    // Cleanup on app unmount
    app.config.globalProperties.$outlit = outlitRef.value
  },
}
