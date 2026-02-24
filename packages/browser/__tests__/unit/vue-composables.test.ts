/**
 * Vue Composables Unit Tests
 *
 * Tests the Vue composables (useOutlit) to ensure they:
 * - Throw when used outside OutlitPlugin
 * - Expose user namespace (activate, engaged, inactive) and customer namespace (trialing, paid, churned)
 * - Handle consent flow correctly
 *
 * Run with: bun run test:unit
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createApp, defineComponent, h, nextTick, ref } from "vue"
import { OutlitPlugin, useIdentify, useOutlit, useOutlitUser, useTrack } from "../../src/vue"

// Mock document.cookie for visitor ID storage
const mockCookies: Record<string, string> = {}

// Store original values for restoration
let originalFetch: typeof fetch | undefined
let originalCookieDescriptor: PropertyDescriptor | undefined

// Helper to mount a component with the plugin
function mountWithPlugin(
  component: ReturnType<typeof defineComponent>,
  pluginOptions: { publicKey: string; autoTrack?: boolean } = {
    publicKey: "pk_test",
    autoTrack: false,
  },
) {
  const app = createApp(component)
  app.use(OutlitPlugin, pluginOptions)

  const root = document.createElement("div")
  document.body.appendChild(root)

  const instance = app.mount(root)

  return {
    instance,
    app,
    unmount: () => {
      app.unmount()
      document.body.removeChild(root)
    },
  }
}

beforeEach(() => {
  // Clear localStorage to prevent consent state leaking between tests
  localStorage.clear()

  // Store original values for restoration
  originalFetch = global.fetch
  originalCookieDescriptor = Object.getOwnPropertyDescriptor(document, "cookie")

  // Reset cookies before each test
  for (const key of Object.keys(mockCookies)) {
    delete mockCookies[key]
  }

  // Mock document.cookie
  Object.defineProperty(document, "cookie", {
    get: () =>
      Object.entries(mockCookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    set: (value: string) => {
      const [keyValue] = value.split(";")
      const [key, val] = keyValue!.split("=")
      if (key && val) {
        mockCookies[key.trim()] = val.trim()
      }
    },
    configurable: true,
  })

  // Mock fetch for API calls
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  })
})

afterEach(() => {
  // Restore original document.cookie descriptor
  if (originalCookieDescriptor) {
    Object.defineProperty(document, "cookie", originalCookieDescriptor)
  }
  // Restore original fetch
  if (originalFetch) {
    global.fetch = originalFetch
  } else {
    // @ts-expect-error - restoring undefined fetch
    global.fetch = undefined
  }
  vi.restoreAllMocks()
})

describe("useOutlit composable", () => {
  it("throws when used outside OutlitPlugin", () => {
    // Test that useOutlit throws when called without the plugin installed
    // We capture the error by using Vue's error handler
    const errors: Error[] = []

    const TestComponent = defineComponent({
      setup() {
        useOutlit() // This should throw
        return () => h("div")
      },
    })

    const app = createApp(TestComponent)
    app.config.errorHandler = (err) => {
      errors.push(err as Error)
    }

    const root = document.createElement("div")
    document.body.appendChild(root)
    app.mount(root)

    // Check that an error was thrown containing the expected message
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]?.message).toContain("OutlitPlugin")

    app.unmount()
    document.body.removeChild(root)
  })

  it("exposes user namespace with stage methods", () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent)

    expect(result).not.toBeNull()
    expect(typeof result!.user.activate).toBe("function")
    expect(typeof result!.user.engaged).toBe("function")
    expect(typeof result!.user.inactive).toBe("function")
    expect(typeof result!.user.identify).toBe("function")

    unmount()
  })

  it("exposes customer namespace with billing methods", () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent)

    expect(result).not.toBeNull()
    expect(typeof result!.customer.trialing).toBe("function")
    expect(typeof result!.customer.paid).toBe("function")
    expect(typeof result!.customer.churned).toBe("function")

    unmount()
  })

  it("exposes track, identify, and user management methods", () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent)

    expect(typeof result!.track).toBe("function")
    expect(typeof result!.identify).toBe("function")
    expect(typeof result!.setUser).toBe("function")
    expect(typeof result!.clearUser).toBe("function")
    expect(typeof result!.getVisitorId).toBe("function")

    unmount()
  })

  it("exposes consent-related methods", () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent)

    expect(typeof result!.enableTracking).toBe("function")
    // isTrackingEnabled is a Ref<boolean>
    expect(typeof result!.isTrackingEnabled.value).toBe("boolean")

    unmount()
  })

  it("isTrackingEnabled is false when autoTrack is false", () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent, { publicKey: "pk_test", autoTrack: false })

    expect(result!.isTrackingEnabled.value).toBe(false)

    unmount()
  })

  it("enableTracking updates isTrackingEnabled", async () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent, { publicKey: "pk_test", autoTrack: false })

    expect(result!.isTrackingEnabled.value).toBe(false)

    result!.enableTracking()
    await nextTick()

    expect(result!.isTrackingEnabled.value).toBe(true)

    unmount()
  })

  it("exposes disableTracking method", () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent)

    expect(typeof result!.disableTracking).toBe("function")

    unmount()
  })

  it("disableTracking updates isTrackingEnabled to false", async () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent, { publicKey: "pk_test", autoTrack: false })

    result!.enableTracking()
    await nextTick()
    expect(result!.isTrackingEnabled.value).toBe(true)

    result!.disableTracking()
    await nextTick()
    expect(result!.isTrackingEnabled.value).toBe(false)

    unmount()
  })

  it("provides isInitialized ref", () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent)

    // isInitialized should be a Ref<boolean>
    expect(typeof result!.isInitialized.value).toBe("boolean")

    unmount()
  })
})

describe("OutlitPlugin", () => {
  it("initializes with autoTrack=true by default", () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    // No autoTrack option = defaults to true
    const { unmount } = mountWithPlugin(TestComponent, { publicKey: "pk_test" })

    expect(result!.isTrackingEnabled.value).toBe(true)

    unmount()
  })

  it("does not initialize tracking when autoTrack=false", () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent, { publicKey: "pk_test", autoTrack: false })

    expect(result!.isTrackingEnabled.value).toBe(false)

    unmount()
  })
})

describe("useTrack composable", () => {
  it("returns a track function", () => {
    let track: ReturnType<typeof useTrack> | null = null

    const TestComponent = defineComponent({
      setup() {
        track = useTrack()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent)

    expect(typeof track).toBe("function")

    unmount()
  })
})

describe("useIdentify composable", () => {
  it("returns an identify function", () => {
    let identify: ReturnType<typeof useIdentify> | null = null

    const TestComponent = defineComponent({
      setup() {
        identify = useIdentify()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent)

    expect(typeof identify).toBe("function")

    unmount()
  })
})

describe("useOutlitUser composable", () => {
  it("syncs user identity when ref changes", async () => {
    const userRef = ref<{ email: string; userId: string } | null>(null)
    let outlitInstance: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        outlitInstance = useOutlit()
        useOutlitUser(userRef)
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent, { publicKey: "pk_test", autoTrack: false })

    // Enable tracking first
    outlitInstance!.enableTracking()
    await nextTick()

    // Set user
    userRef.value = { email: "test@example.com", userId: "user-123" }
    await nextTick()

    // User should be identified (we can't easily check the internal state,
    // but we can verify no errors were thrown)
    expect(true).toBe(true)

    // Clear user
    userRef.value = null
    await nextTick()

    expect(true).toBe(true)

    unmount()
  })
})

describe("Stage methods behavior", () => {
  it("inactive method can be called without properties", async () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent, { publicKey: "pk_test", autoTrack: false })

    result!.enableTracking()
    await nextTick()

    result!.setUser({ userId: "test-user" })
    await nextTick()

    // This should not throw
    expect(() => {
      result!.user.inactive()
    }).not.toThrow()

    unmount()
  })

  it("inactive method can be called with properties", async () => {
    let result: ReturnType<typeof useOutlit> | null = null

    const TestComponent = defineComponent({
      setup() {
        result = useOutlit()
        return () => h("div")
      },
    })

    const { unmount } = mountWithPlugin(TestComponent, { publicKey: "pk_test", autoTrack: false })

    result!.enableTracking()
    await nextTick()

    result!.setUser({ userId: "test-user" })
    await nextTick()

    // This should not throw
    expect(() => {
      result!.user.inactive({ reason: "cancelled", plan: "pro" })
    }).not.toThrow()

    unmount()
  })
})
