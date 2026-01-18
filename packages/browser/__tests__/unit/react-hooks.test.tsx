/**
 * React Hooks Unit Tests
 *
 * Tests the React hooks (useOutlit) to ensure they:
 * - Warn when used outside OutlitProvider
 * - Expose user namespace (activate, engaged, inactive) and customer namespace (trialing, paid, churned)
 * - Handle consent flow correctly
 *
 * Run with: pnpm test:unit
 */

import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OutlitProvider, useOutlit } from "../../src/react"

// Mock document.cookie for visitor ID storage
const mockCookies: Record<string, string> = {}

beforeEach(() => {
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
