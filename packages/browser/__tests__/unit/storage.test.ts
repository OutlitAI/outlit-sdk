import { beforeEach, describe, expect, it } from "vitest"
import { clearConsentState, getConsentState, setConsentState } from "../../src/storage"

const mockCookies: Record<string, string> = {}

beforeEach(() => {
  localStorage.clear()
  for (const key of Object.keys(mockCookies)) {
    delete mockCookies[key]
  }
  Object.defineProperty(document, "cookie", {
    get: () =>
      Object.entries(mockCookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    set: (value: string) => {
      const [keyValue] = value.split(";")
      const [key, val] = keyValue!.split("=")
      if (key) {
        if (val) {
          mockCookies[key.trim()] = val.trim()
        } else {
          delete mockCookies[key.trim()]
        }
      }
    },
    configurable: true,
  })
})

describe("consent state storage", () => {
  it("returns null when no consent state is stored", () => {
    expect(getConsentState()).toBeNull()
  })

  it("persists granted consent and reads it back", () => {
    setConsentState(true)
    expect(getConsentState()).toBe("opted-in")
  })

  it("persists denied consent and reads it back", () => {
    setConsentState(false)
    expect(getConsentState()).toBe("opted-out")
  })

  it("stores the explicit opt-in marker in localStorage", () => {
    setConsentState(true)
    expect(localStorage.getItem("outlit_consent")).toBe("2")
  })

  it("stores the explicit opt-in marker in cookie", () => {
    setConsentState(true)
    expect(mockCookies.outlit_consent).toBe("2")
  })

  it('reads legacy "1" values as legacy-opted-in', () => {
    localStorage.setItem("outlit_consent", "1")
    expect(getConsentState()).toBe("legacy-opted-in")
  })

  it('reads legacy "1" cookie values as legacy-opted-in', () => {
    mockCookies.outlit_consent = "1"
    expect(getConsentState()).toBe("legacy-opted-in")
  })

  it("reads from cookie when localStorage is unavailable", () => {
    setConsentState(true)
    localStorage.clear()
    expect(getConsentState()).toBe("opted-in")
  })

  it("doesn't mark cookies Secure on plain-HTTP pages", () => {
    const writes: string[] = []
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: (value: string) => {
        writes.push(value)
      },
      configurable: true,
    })

    setConsentState(true)

    expect(writes).toHaveLength(1)
    expect(writes[0]).not.toContain("Secure")
  })

  it("clears consent state from localStorage and cookie", () => {
    setConsentState(true)
    clearConsentState()
    expect(getConsentState()).toBeNull()
    expect(localStorage.getItem("outlit_consent")).toBeNull()
  })
})
