/**
 * IIFE entry point for CDN script tag usage.
 *
 * Usage (with stub snippet - recommended):
 * <script>
 *   !function(w,d,src,key,auto){
 *     if(w.outlit&&w.outlit._loaded)return;
 *     var o=w.outlit=w.outlit||{_q:[]};
 *     function stub(target,prefix,methods){
 *       for(var i=0;i<methods.length;i++){
 *         var m=methods[i];
 *         target[m]=target[m]||function(mm){
 *           return function(){o._q.push([prefix?prefix+"."+mm:mm,[].slice.call(arguments)])};
 *         }(m);
 *       }
 *     }
 *     stub(o,"",["init","track","identify","enableTracking","isTrackingEnabled","getVisitorId","setUser","clearUser"]);
 *     o.user=o.user||{};o.customer=o.customer||{};
 *     stub(o.user,"user",["identify","activate","engaged","inactive"]);
 *     stub(o.customer,"customer",["trialing","paid","churned"]);
 *     var s=d.createElement("script");s.async=1;s.src=src;
 *     s.dataset.publicKey=key;if(auto!==undefined)s.dataset.autoTrack=auto;
 *     (d.body||d.head).appendChild(s);
 *   }(window,document,"https://cdn.outlit.ai/outlit.js","pk_xxx");
 * </script>
 *
 * Usage (simple script tag):
 * <script src="https://cdn.outlit.ai/outlit.js" data-public-key="pk_xxx" async></script>
 *
 * Usage (with consent management):
 * Pass `false` as last param to stub, or use data-auto-track="false" on script tag
 */

import type { BrowserIdentifyOptions, BrowserTrackOptions } from "@outlit/core"
import { type BillingOptions, Outlit, type OutlitOptions, type UserIdentity } from "./tracker"

// ============================================
// TYPES
// ============================================

// Stub queue format: [methodName, arguments]
type StubQueueItem = [string, unknown[]]

interface OutlitStub {
  _q?: StubQueueItem[]
  [key: string]: unknown
}

interface OutlitGlobal {
  _initialized: boolean
  _instance: Outlit | null
  _queue: Array<() => void>
  init: (options: OutlitOptions) => void
  track: (eventName: string, properties?: BrowserTrackOptions["properties"]) => void
  identify: (options: BrowserIdentifyOptions) => void
  getVisitorId: () => string | null
  enableTracking: () => void
  isTrackingEnabled: () => boolean
  setUser: (identity: UserIdentity) => void
  clearUser: () => void
  user: {
    identify: (options: BrowserIdentifyOptions) => void
    activate: (properties?: Record<string, string | number | boolean | null>) => void
    engaged: (properties?: Record<string, string | number | boolean | null>) => void
    inactive: (properties?: Record<string, string | number | boolean | null>) => void
  }
  customer: {
    trialing: (options: BillingOptions) => void
    paid: (options: BillingOptions) => void
    churned: (options: BillingOptions) => void
  }
}

// ============================================
// GLOBAL API
// ============================================

// Check for existing stub with queued calls
const existingStub =
  typeof window !== "undefined" ? (window as { outlit?: OutlitStub }).outlit : undefined
const stubQueue: StubQueueItem[] = existingStub?._q || []

// Create global object with queuing support
const outlit: OutlitGlobal & { _loaded?: boolean } = {
  _initialized: false,
  _instance: null,
  _queue: [],
  _loaded: true, // Marks that the real SDK has loaded (for double-load protection)

  init(options: OutlitOptions) {
    if (this._initialized) {
      console.warn("[Outlit] Already initialized")
      return
    }

    this._instance = new Outlit(options)
    this._initialized = true

    // Process calls queued by the stub snippet (before SDK loaded)
    for (const [method, args] of stubQueue) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = this as any

      // Handle namespace methods like "user.activate" or "customer.paid"
      if (method.includes(".")) {
        const [namespace, methodName] = method.split(".")
        if (
          namespace &&
          methodName &&
          namespace in self &&
          typeof self[namespace][methodName] === "function"
        ) {
          self[namespace][methodName](...args)
        }
      } else if (method in self && typeof self[method] === "function") {
        self[method](...args)
      }
    }

    // Process calls queued after SDK loaded but before init
    while (this._queue.length > 0) {
      const fn = this._queue.shift()
      fn?.()
    }
  },

  track(eventName: string, properties?: BrowserTrackOptions["properties"]) {
    if (!this._initialized || !this._instance) {
      // Queue the call for after initialization
      this._queue.push(() => this.track(eventName, properties))
      return
    }
    this._instance.track(eventName, properties)
  },

  identify(options: BrowserIdentifyOptions) {
    if (!this._initialized || !this._instance) {
      // Queue the call for after initialization
      this._queue.push(() => this.identify(options))
      return
    }
    this._instance.identify(options)
  },

  getVisitorId() {
    if (!this._instance) return null
    return this._instance.getVisitorId()
  },

  /**
   * Enable tracking after user consent.
   * Call this in your consent management tool's callback.
   */
  enableTracking() {
    if (!this._initialized || !this._instance) {
      // Queue the call for after initialization
      this._queue.push(() => this.enableTracking())
      return
    }
    this._instance.enableTracking()
  },

  /**
   * Check if tracking is currently enabled.
   */
  isTrackingEnabled() {
    if (!this._instance) return false
    return this._instance.isEnabled()
  },

  /**
   * Set the user identity for attribution.
   */
  setUser(identity: UserIdentity) {
    if (!this._initialized || !this._instance) {
      this._queue.push(() => this.setUser(identity))
      return
    }
    this._instance.setUser(identity)
  },

  /**
   * Clear the current user identity (logout).
   */
  clearUser() {
    if (!this._initialized || !this._instance) {
      this._queue.push(() => this.clearUser())
      return
    }
    this._instance.clearUser()
  },

  /**
   * User namespace helpers.
   */
  user: {
    identify(options: BrowserIdentifyOptions) {
      if (!outlit._initialized || !outlit._instance) {
        outlit._queue.push(() => outlit.user.identify(options))
        return
      }
      outlit._instance.user.identify(options)
    },
    activate(properties?: Record<string, string | number | boolean | null>) {
      if (!outlit._initialized || !outlit._instance) {
        outlit._queue.push(() => outlit.user.activate(properties))
        return
      }
      outlit._instance.user.activate(properties)
    },
    engaged(properties?: Record<string, string | number | boolean | null>) {
      if (!outlit._initialized || !outlit._instance) {
        outlit._queue.push(() => outlit.user.engaged(properties))
        return
      }
      outlit._instance.user.engaged(properties)
    },
    inactive(properties?: Record<string, string | number | boolean | null>) {
      if (!outlit._initialized || !outlit._instance) {
        outlit._queue.push(() => outlit.user.inactive(properties))
        return
      }
      outlit._instance.user.inactive(properties)
    },
  },

  /**
   * Customer namespace helpers.
   */
  customer: {
    trialing(options: BillingOptions) {
      if (!outlit._initialized || !outlit._instance) {
        outlit._queue.push(() => outlit.customer.trialing(options))
        return
      }
      outlit._instance.customer.trialing(options)
    },
    paid(options: BillingOptions) {
      if (!outlit._initialized || !outlit._instance) {
        outlit._queue.push(() => outlit.customer.paid(options))
        return
      }
      outlit._instance.customer.paid(options)
    },
    churned(options: BillingOptions) {
      if (!outlit._initialized || !outlit._instance) {
        outlit._queue.push(() => outlit.customer.churned(options))
        return
      }
      outlit._instance.customer.churned(options)
    },
  },
}

// ============================================
// AUTO-INITIALIZATION
// ============================================

/**
 * Auto-initialize from script tag attributes.
 */
function autoInit(): void {
  // Find the script tag - currentScript is only available during synchronous execution
  // When called from DOMContentLoaded, we need to fall back to querySelector
  let script = document.currentScript as HTMLScriptElement | null

  if (!script) {
    // Fallback: find script tag with data-public-key attribute
    script = document.querySelector("script[data-public-key]") as HTMLScriptElement | null
  }

  if (!script) {
    console.warn("[Outlit] No script tag found with data-public-key attribute")
    return
  }

  const publicKey = script.getAttribute("data-public-key")
  if (!publicKey) {
    console.warn("[Outlit] Missing data-public-key attribute on script tag")
    return
  }

  // Get optional attributes
  const apiHost = script.getAttribute("data-api-host") ?? undefined
  const trackPageviews = script.getAttribute("data-track-pageviews") !== "false"
  const trackForms = script.getAttribute("data-track-forms") !== "false"
  const autoTrack = script.getAttribute("data-auto-track") !== "false"
  const autoIdentify = script.getAttribute("data-auto-identify") !== "false"
  const trackCalendarEmbeds = script.getAttribute("data-track-calendar-embeds") !== "false"

  // Initialize
  outlit.init({
    publicKey,
    apiHost,
    trackPageviews,
    trackForms,
    autoTrack,
    autoIdentify,
    trackCalendarEmbeds,
  })
}

// ============================================
// EXPOSE GLOBAL & AUTO-INIT
// ============================================

// Expose on window
if (typeof window !== "undefined") {
  // @ts-expect-error - Adding to window
  window.outlit = outlit

  // Auto-initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit)
  } else {
    // DOM is already ready
    autoInit()
  }
}

// Also export for module usage if needed
export { outlit }
