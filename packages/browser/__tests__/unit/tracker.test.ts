import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Outlit } from "../../src/tracker"

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
      if (key && val) {
        mockCookies[key.trim()] = val.trim()
      }
    },
    configurable: true,
  })
  global.fetch = vi.fn().mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("disableTracking", () => {
  it("disables tracking after it was enabled", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: true })
    expect(outlit.isEnabled()).toBe(true)

    await outlit.disableTracking()
    expect(outlit.isEnabled()).toBe(false)
  })

  it("persists opt-out decision", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: true })
    await outlit.disableTracking()
    expect(localStorage.getItem("outlit_consent")).toBe("0")
  })

  it("persists opt-out even when called before enableTracking", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: false })
    await outlit.disableTracking()
    expect(localStorage.getItem("outlit_consent")).toBe("0")
  })

  it("allows re-enabling tracking after disable", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: true })
    await outlit.disableTracking()
    expect(outlit.isEnabled()).toBe(false)

    outlit.enableTracking()
    expect(outlit.isEnabled()).toBe(true)
    expect(localStorage.getItem("outlit_consent")).toBe("1")
  })
})

describe("enableTracking consent persistence", () => {
  it("persists opt-in decision", () => {
    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: false })
    outlit.enableTracking()
    expect(localStorage.getItem("outlit_consent")).toBe("1")
  })
})

describe("consent state on init", () => {
  it("auto-enables tracking when consent was previously granted", () => {
    localStorage.setItem("outlit_consent", "1")
    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: false })
    expect(outlit.isEnabled()).toBe(true)
  })

  it("does not auto-enable when consent was previously denied", () => {
    localStorage.setItem("outlit_consent", "0")
    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: true })
    expect(outlit.isEnabled()).toBe(false)
  })

  it("falls back to autoTrack when no consent state exists", () => {
    const outlitAuto = new Outlit({ publicKey: "pk_test", autoTrack: true })
    expect(outlitAuto.isEnabled()).toBe(true)
  })

  it("falls back to autoTrack=false when no consent state exists", () => {
    const outlitNoAuto = new Outlit({ publicKey: "pk_test", autoTrack: false })
    expect(outlitNoAuto.isEnabled()).toBe(false)
  })
})
