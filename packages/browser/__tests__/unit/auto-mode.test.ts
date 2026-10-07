// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Outlit } from "../../src/tracker"

const mockCookies: Record<string, string> = {}
const mockLocalStorage: Record<string, string> = {}

const BOOTSTRAP_URL = "https://app.outlit.ai/api/i/v1/pk_test/bootstrap"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function bootstrapResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) }
}

async function settleBootstrap() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function outlitStorageKeys() {
  return Object.keys(mockLocalStorage).filter((k) => k.startsWith("outlit"))
}

function outlitCookieKeys() {
  return Object.keys(mockCookies).filter((k) => k.startsWith("outlit"))
}

function eventPayloads() {
  return vi
    .mocked(global.fetch)
    .mock.calls.filter(([url]) => String(url).includes("/events"))
    .map(([, init]) => JSON.parse(String(init?.body))) as Array<{
    events: Array<{ type: string; eventName?: string; email?: string }>
  }>
}

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
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("autoTrack auto mode", () => {
  it("enables tracking when bootstrap reports consent not required", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(bootstrapResponse({ country: "US", consentRequired: false }))

    const outlit = new Outlit({ publicKey: "pk_test" })

    // Decision is pending — tracking is not enabled synchronously
    expect(outlit.isEnabled()).toBe(false)
    expect(outlit.getVisitorId()).toBeNull()

    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))

    expect(global.fetch).toHaveBeenCalledWith(
      BOOTSTRAP_URL,
      expect.objectContaining({ credentials: "omit" }),
    )
    expect(outlit.getVisitorId()).toBeTruthy()
    // Automatic enable must not persist a consent decision
    expect(localStorage.getItem("outlit_consent")).toBeNull()
    expect(mockCookies.outlit_consent).toBeUndefined()
  })

  it("uses the configured apiHost for the bootstrap request", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(bootstrapResponse({ country: null, consentRequired: true }))

    const outlit = new Outlit({ publicKey: "pk_test", apiHost: "https://edge.example.com/" })

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      "https://edge.example.com/api/i/v1/pk_test/bootstrap",
      expect.any(Object),
    )
    await settleBootstrap()
    expect(outlit.isEnabled()).toBe(false)
  })

  it("stays disabled and stores nothing when consent is required", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(bootstrapResponse({ country: "DE", consentRequired: true }))

    const outlit = new Outlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlit.getVisitorId()).toBeNull()
    expect(outlitStorageKeys()).toEqual([])
    expect(outlitCookieKeys()).toEqual([])
  })

  it("stays disabled on non-2xx responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    const outlit = new Outlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlitStorageKeys()).toEqual([])
    expect(outlitCookieKeys()).toEqual([])
  })

  it("stays disabled on network errors", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"))

    const outlit = new Outlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlitStorageKeys()).toEqual([])
    expect(outlitCookieKeys()).toEqual([])
  })

  it("stays disabled on malformed JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("invalid json")),
    })

    const outlit = new Outlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlitStorageKeys()).toEqual([])
  })

  it("stays disabled when fetch is unavailable", async () => {
    // @ts-expect-error - simulate environments without fetch
    global.fetch = undefined

    const outlit = new Outlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlitStorageKeys()).toEqual([])
  })

  it("stays disabled when the bootstrap request times out", async () => {
    vi.useFakeTimers()
    try {
      global.fetch = vi.fn().mockImplementation(
        (_url, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted", "AbortError"))
            })
          }),
      )

      const outlit = new Outlit({ publicKey: "pk_test" })
      expect(outlit.isEnabled()).toBe(false)

      await vi.advanceTimersByTimeAsync(4000)

      expect(outlit.isEnabled()).toBe(false)
      expect(outlit.getVisitorId()).toBeNull()
      expect(outlitStorageKeys()).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not fetch when consent was denied previously", async () => {
    global.fetch = vi.fn().mockResolvedValue(bootstrapResponse({ consentRequired: false }))
    localStorage.setItem("outlit_consent", "0")

    const outlit = new Outlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(global.fetch).not.toHaveBeenCalled()
    expect(outlit.isEnabled()).toBe(false)
  })

  it("enables immediately without fetching when explicit opt-in was persisted", async () => {
    global.fetch = vi.fn().mockResolvedValue(bootstrapResponse({ consentRequired: true }))
    localStorage.setItem("outlit_consent", "2")

    const outlit = new Outlit({ publicKey: "pk_test" })

    expect(outlit.isEnabled()).toBe(true)
    await settleBootstrap()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches bootstrap for legacy "1" consent values in auto mode', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(bootstrapResponse({ country: "DE", consentRequired: true }))
    localStorage.setItem("outlit_consent", "1")

    const outlit = new Outlit({ publicKey: "pk_test" })

    // Legacy "1" is not a real consent decision in auto mode
    expect(outlit.isEnabled()).toBe(false)
    await vi.waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(BOOTSTRAP_URL, expect.anything()),
    )
    await settleBootstrap()
    expect(outlit.isEnabled()).toBe(false)
  })

  it('treats legacy "1" consent as opted-in when autoTrack is true', async () => {
    global.fetch = vi.fn().mockResolvedValue(bootstrapResponse({ consentRequired: true }))
    localStorage.setItem("outlit_consent", "1")

    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: true })

    expect(outlit.isEnabled()).toBe(true)
    await settleBootstrap()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('treats legacy "1" consent as opted-in when autoTrack is false', async () => {
    global.fetch = vi.fn().mockResolvedValue(bootstrapResponse({ consentRequired: true }))
    localStorage.setItem("outlit_consent", "1")

    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: false })

    expect(outlit.isEnabled()).toBe(true)
    await settleBootstrap()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("explicit enableTracking during pending wins over a late consent-required result", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = new Outlit({ publicKey: "pk_test" })
    expect(outlit.isEnabled()).toBe(false)

    outlit.enableTracking()
    expect(outlit.isEnabled()).toBe(true)
    expect(localStorage.getItem("outlit_consent")).toBe("2")

    pending.resolve(bootstrapResponse({ country: "DE", consentRequired: true }))
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(true)
  })

  it("explicit enableTracking after an automatic enable still persists the opt-in", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(bootstrapResponse({ country: "US", consentRequired: false }))

    const outlit = new Outlit({ publicKey: "pk_test" })
    await settleBootstrap()

    // Automatic enable persisted nothing
    expect(outlit.isEnabled()).toBe(true)
    expect(localStorage.getItem("outlit_consent")).toBeNull()

    // The explicit call still records consent
    outlit.enableTracking()
    expect(localStorage.getItem("outlit_consent")).toBe("2")
  })

  it("explicit disableTracking during pending wins over a late not-required result", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = new Outlit({ publicKey: "pk_test" })

    await outlit.disableTracking()
    expect(localStorage.getItem("outlit_consent")).toBe("0")

    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlit.getVisitorId()).toBeNull()
  })

  it("shutdown during pending ignores a late bootstrap result", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = new Outlit({ publicKey: "pk_test" })
    await outlit.shutdown()

    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlit.getVisitorId()).toBeNull()
  })

  it("buffers track calls while pending and replays them after auto-enable", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const outlit = new Outlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })

    outlit.track("early_event", { source: "buffered" })
    outlit.identify({ email: "early@example.com" })

    expect(
      warn.mock.calls.filter(([msg]) => String(msg).includes("Tracking not enabled")),
    ).toHaveLength(0)

    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))

    await outlit.flush()
    const payloads = eventPayloads()
    expect(payloads).toHaveLength(1)
    expect(payloads[0]?.events).toEqual([
      expect.objectContaining({ type: "custom", eventName: "early_event" }),
      expect.objectContaining({ type: "identify", email: "early@example.com" }),
    ])
  })

  it("discards buffered calls when consent is required", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue({ ok: true })

    const outlit = new Outlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })

    outlit.track("pre_consent_event")

    pending.resolve(bootstrapResponse({ country: "DE", consentRequired: true }))
    await settleBootstrap()
    expect(outlit.isEnabled()).toBe(false)

    // Explicit consent later — pre-consent events must never be sent
    outlit.enableTracking()
    outlit.track("post_consent_event")
    await outlit.flush()

    const events = eventPayloads().flatMap((p) => p.events)
    expect(events.some((e) => e.eventName === "pre_consent_event")).toBe(false)
    expect(events.some((e) => e.eventName === "post_consent_event")).toBe(true)
  })

  it("notifies tracking-state listeners when auto mode enables tracking", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(bootstrapResponse({ country: "US", consentRequired: false }))

    const outlit = new Outlit({ publicKey: "pk_test" })
    const listener = vi.fn()
    const unsubscribe = outlit.onTrackingStateChange(listener)

    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))
    expect(listener).toHaveBeenCalledWith(true)

    unsubscribe()
    await outlit.disableTracking()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("still warns and drops track calls when autoTrack is false", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const outlit = new Outlit({ publicKey: "pk_test", autoTrack: false })

    outlit.track("dropped_event")

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Tracking not enabled"))
  })
})
