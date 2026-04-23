// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Outlit } from "../../src/tracker"

const mockCookies: Record<string, string> = {}
const mockLocalStorage: Record<string, string> = {}
const uuidV7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      clear: () => {
        for (const key of Object.keys(mockLocalStorage)) {
          delete mockLocalStorage[key]
        }
      },
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      removeItem: (key: string) => {
        delete mockLocalStorage[key]
      },
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value
      },
    },
    configurable: true,
  })
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

describe("payload identity", () => {
  it("defaults event delivery to the hosted Outlit ingest endpoint", async () => {
    const outlit = new Outlit({
      publicKey: "pk_test",
      autoTrack: false,
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
    })

    outlit.enableTracking()
    outlit.track("button_clicked", { buttonId: "cta" })

    await outlit.flush()

    expect(global.fetch).toHaveBeenCalledWith(
      "https://app.outlit.ai/api/i/v1/pk_test/events",
      expect.any(Object),
    )
  })

  it("sends custom track events with an event uuid", async () => {
    const outlit = new Outlit({
      publicKey: "pk_test",
      autoTrack: false,
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
    })

    outlit.enableTracking()
    outlit.track("button_clicked", { buttonId: "cta" })

    await outlit.flush()

    const fetchOptions = vi.mocked(global.fetch).mock.calls[0]?.[1]
    const payload = JSON.parse(String(fetchOptions?.body)) as {
      events: Array<{ type: string; uuid?: string }>
    }
    const event = payload.events[0]

    expect(event?.type).toBe("custom")
    expect(event?.uuid).toMatch(uuidV7Regex)
  })

  it("does not include profile traits in non-identify browser batches", async () => {
    const outlit = new Outlit({
      publicKey: "pk_test",
      autoTrack: false,
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
    })

    outlit.enableTracking()
    outlit.identify({
      email: "user@example.com",
      customerId: "cust_123",
      traits: { role: "admin" },
      customerTraits: { plan: "enterprise" },
    })
    outlit.track("button_clicked", { buttonId: "cta" })

    await outlit.flush()

    expect(global.fetch).toHaveBeenCalledTimes(1)

    const fetchOptions = vi.mocked(global.fetch).mock.calls[0]?.[1]
    const payload = JSON.parse(String(fetchOptions?.body)) as {
      userIdentity?: Record<string, unknown>
      customerIdentity?: Record<string, unknown>
      events: Array<{ type: string }>
    }

    expect(payload.events).toHaveLength(2)
    expect(payload.events.map((event) => event.type)).toEqual(["identify", "custom"])
    expect(payload.userIdentity).toEqual({
      email: "user@example.com",
    })
    expect(payload.customerIdentity).toEqual({
      customerId: "cust_123",
    })
    expect(payload.userIdentity).not.toHaveProperty("traits")
    expect(payload.userIdentity).not.toHaveProperty("customerId")
    expect(payload.customerIdentity).not.toHaveProperty("customerTraits")
  })

  it("includes an activation event name on user activation stage events", async () => {
    const outlit = new Outlit({
      publicKey: "pk_test",
      autoTrack: false,
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
    })

    outlit.enableTracking()
    outlit.setUser({ userId: "user_123" })
    outlit.user.activate({ milestone: "first_project_created" })

    await outlit.flush()

    const fetchOptions = vi.mocked(global.fetch).mock.calls[0]?.[1]
    const payload = JSON.parse(String(fetchOptions?.body)) as {
      events: Array<{ type: string; stage?: string; eventName?: string }>
    }
    const activationEvent = payload.events.find(
      (event) => event.type === "stage" && event.stage === "activated",
    )

    expect(activationEvent?.eventName).toBe("activated")
  })
})
