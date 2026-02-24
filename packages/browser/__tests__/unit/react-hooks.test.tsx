/**
 * React Hooks Unit Tests
 *
 * Tests the React hooks (useOutlit) to ensure they:
 * - Warn when used outside OutlitProvider
 * - Expose user namespace (activate, engaged, inactive) and customer namespace (trialing, paid, churned)
 * - Handle consent flow correctly
 *
 * Run with: bun run test:unit
 */

import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OutlitProvider, useOutlit } from "../../src/react"
import { Outlit } from "../../src/tracker"

// Mock document.cookie for visitor ID storage
const mockCookies: Record<string, string> = {}

beforeEach(() => {
  // Clear localStorage to reset consent state (outlit_consent key)
  localStorage.clear()

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
  vi.restoreAllMocks()
})

describe("useOutlit hook", () => {
  it("warns when used outside OutlitProvider", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { result } = renderHook(() => useOutlit())

    // Try to call a method - should warn
    act(() => {
      result.current.track("test-event")
    })

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("OutlitProvider"))
    consoleSpy.mockRestore()
  })

  it("exposes user namespace with stage methods", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    // Verify user namespace methods exist and are functions
    expect(typeof result.current.user.activate).toBe("function")
    expect(typeof result.current.user.engaged).toBe("function")
    expect(typeof result.current.user.inactive).toBe("function")
    expect(typeof result.current.user.identify).toBe("function")
  })

  it("exposes customer namespace with billing methods", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    // Verify customer namespace methods exist and are functions
    expect(typeof result.current.customer.trialing).toBe("function")
    expect(typeof result.current.customer.paid).toBe("function")
    expect(typeof result.current.customer.churned).toBe("function")
  })

  it("exposes track, identify, and user management methods", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    expect(typeof result.current.track).toBe("function")
    expect(typeof result.current.identify).toBe("function")
    expect(typeof result.current.setUser).toBe("function")
    expect(typeof result.current.clearUser).toBe("function")
    expect(typeof result.current.getVisitorId).toBe("function")
  })

  it("exposes consent-related methods", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    expect(typeof result.current.enableTracking).toBe("function")
    expect(typeof result.current.isTrackingEnabled).toBe("boolean")
  })

  it("isTrackingEnabled is false when autoTrack is false", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    expect(result.current.isTrackingEnabled).toBe(false)
  })

  it("enableTracking updates isTrackingEnabled", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    expect(result.current.isTrackingEnabled).toBe(false)

    act(() => {
      result.current.enableTracking()
    })

    expect(result.current.isTrackingEnabled).toBe(true)
  })

  it("provides isInitialized boolean", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    // isInitialized should be a boolean (may be false initially, true after SDK loads)
    expect(typeof result.current.isInitialized).toBe("boolean")
  })

  it("exposes disableTracking method", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    expect(typeof result.current.disableTracking).toBe("function")
  })

  it("disableTracking updates isTrackingEnabled to false", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    // Enable first
    act(() => {
      result.current.enableTracking()
    })
    expect(result.current.isTrackingEnabled).toBe(true)

    // Then disable
    await act(async () => {
      result.current.disableTracking()
    })
    expect(result.current.isTrackingEnabled).toBe(false)
  })
})

describe("OutlitProvider", () => {
  it("initializes with autoTrack=true by default", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test">{children}</OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    // Default is autoTrack=true, so tracking should be enabled
    expect(result.current.isTrackingEnabled).toBe(true)
  })

  it("does not initialize tracking when autoTrack=false", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    expect(result.current.isTrackingEnabled).toBe(false)
  })
})

describe("Stage methods behavior", () => {
  it("inactive method can be called without properties", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    // Should not throw when called without properties
    act(() => {
      result.current.enableTracking()
      result.current.setUser({ userId: "test-user" })
    })

    // This should not throw
    expect(() => {
      act(() => {
        result.current.user.inactive()
      })
    }).not.toThrow()
  })

  it("inactive method can be called with properties", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    act(() => {
      result.current.enableTracking()
      result.current.setUser({ userId: "test-user" })
    })

    // This should not throw
    expect(() => {
      act(() => {
        result.current.user.inactive({ reason: "cancelled", plan: "pro" })
      })
    }).not.toThrow()
  })
})

// ============================================
// OutlitProvider client prop tests
// ============================================

describe("OutlitProvider with client prop", () => {
  it("uses the provided client instance", () => {
    const client = new Outlit({ publicKey: "pk_test", autoTrack: false })

    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider client={client}>{children}</OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    // useOutlit should expose methods from the provided instance
    expect(result.current.isInitialized).toBe(true)
    expect(typeof result.current.track).toBe("function")

    // Calling track should delegate to the provided client
    const trackSpy = vi.spyOn(client, "track")
    act(() => {
      result.current.track("test-event", { key: "value" })
    })
    expect(trackSpy).toHaveBeenCalledWith("test-event", { key: "value" })
  })

  it("does not call shutdown on unmount when client is provided", () => {
    const client = new Outlit({ publicKey: "pk_test", autoTrack: false })
    const shutdownSpy = vi.spyOn(client, "shutdown")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider client={client}>{children}</OutlitProvider>
    )

    const { unmount } = renderHook(() => useOutlit(), { wrapper })

    unmount()

    expect(shutdownSpy).not.toHaveBeenCalled()
  })

  it("calls shutdown on unmount when using config mode (publicKey)", () => {
    // We need to spy on the Outlit prototype since the instance is created internally
    const shutdownSpy = vi.spyOn(Outlit.prototype, "shutdown")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider publicKey="pk_test" autoTrack={false}>
        {children}
      </OutlitProvider>
    )

    const { unmount } = renderHook(() => useOutlit(), { wrapper })

    unmount()

    expect(shutdownSpy).toHaveBeenCalled()
  })

  it("still handles user identity changes with client prop", () => {
    const client = new Outlit({ publicKey: "pk_test", autoTrack: false })
    const setUserSpy = vi.spyOn(client, "setUser")
    const clearUserSpy = vi.spyOn(client, "clearUser")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider client={client} user={{ email: "test@example.com" }}>
        {children}
      </OutlitProvider>
    )

    renderHook(() => useOutlit(), { wrapper })

    expect(setUserSpy).toHaveBeenCalledWith({ email: "test@example.com" })
    expect(clearUserSpy).not.toHaveBeenCalled()
  })

  it("calls clearUser when user prop changes to null with client", () => {
    const client = new Outlit({ publicKey: "pk_test", autoTrack: false })
    const clearUserSpy = vi.spyOn(client, "clearUser")

    let user: { email: string } | null = { email: "test@example.com" }

    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider client={client} user={user}>
        {children}
      </OutlitProvider>
    )

    const { rerender } = renderHook(() => useOutlit(), { wrapper })

    // Change user to null (logout)
    user = null
    rerender()

    expect(clearUserSpy).toHaveBeenCalled()
  })

  it("useOutlit returns the provided client instance", () => {
    const client = new Outlit({ publicKey: "pk_test", autoTrack: false })

    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider client={client}>{children}</OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    // Verify it's the same instance by checking method delegation
    const identifySpy = vi.spyOn(client, "identify")
    act(() => {
      result.current.identify({ email: "test@example.com" })
    })
    expect(identifySpy).toHaveBeenCalledWith({ email: "test@example.com" })
  })

  it("reflects tracking state from the provided client", () => {
    const client = new Outlit({ publicKey: "pk_test", autoTrack: false })

    const wrapper = ({ children }: { children: ReactNode }) => (
      <OutlitProvider client={client}>{children}</OutlitProvider>
    )

    const { result } = renderHook(() => useOutlit(), { wrapper })

    // Client was created with autoTrack: false
    expect(result.current.isTrackingEnabled).toBe(false)

    // Enable tracking via context
    act(() => {
      result.current.enableTracking()
    })
    expect(result.current.isTrackingEnabled).toBe(true)
    expect(client.isEnabled()).toBe(true)
  })

  it("warns when both client and publicKey are provided", () => {
    const client = new Outlit({ publicKey: "pk_test", autoTrack: false })
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const wrapper = ({ children }: { children: ReactNode }) => (
      // @ts-expect-error - intentionally testing invalid prop combination
      <OutlitProvider client={client} publicKey="pk_other">
        {children}
      </OutlitProvider>
    )

    renderHook(() => useOutlit(), { wrapper })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Both `client` and config props"),
    )
  })
})
