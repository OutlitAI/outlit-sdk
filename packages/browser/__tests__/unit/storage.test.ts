import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
    expect(getConsentState()).toBe(true)
  })

  it("persists denied consent and reads it back", () => {
    setConsentState(false)
    expect(getConsentState()).toBe(false)
  })

  it("stores in localStorage", () => {
    setConsentState(true)
    expect(localStorage.getItem("outlit_consent")).toBe("1")
  })

  it("stores in cookie", () => {
    setConsentState(true)
    expect(mockCookies.outlit_consent).toBe("1")
  })

  it("reads from cookie when localStorage is unavailable", () => {
    setConsentState(true)
    localStorage.clear()
    expect(getConsentState()).toBe(true)
  })

  it("clears consent state from localStorage and cookie", () => {
    setConsentState(true)
    clearConsentState()
    expect(getConsentState()).toBeNull()
    expect(localStorage.getItem("outlit_consent")).toBeNull()
  })
})
