// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Outlit, type OutlitOptions } from "../../src/tracker"

const mockCookies: Record<string, string> = {}
const mockLocalStorage: Record<string, string> = {}
const mockSessionStorage: Record<string, string> = {}

// Every storage write is recorded so tests can assert nothing is persisted
// during the pending window or on any fail-closed path
const cookieWrites: string[] = []
const localWrites: Array<[string, string]> = []
const sessionWrites: Array<[string, string]> = []

const clients: Outlit[] = []

function newOutlit(options: OutlitOptions): Outlit {
  const client = new Outlit(options)
  clients.push(client)
  return client
}

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

function outlitSessionKeys() {
  return Object.keys(mockSessionStorage).filter((k) => k.startsWith("outlit"))
}

function eventPayloads() {
  return vi
    .mocked(global.fetch)
    .mock.calls.filter(([url]) => String(url).includes("/events"))
    .map(([, init]) => JSON.parse(String(init?.body))) as Array<{
    events: Array<{
      type: string
      eventName?: string
      email?: string
      url?: string
      timestamp?: number
      properties?: Record<string, unknown>
    }>
    userIdentity?: { email?: string; userId?: string }
  }>
}

beforeEach(() => {
  cookieWrites.length = 0
  localWrites.length = 0
  sessionWrites.length = 0
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
        localWrites.push([key, value])
        mockLocalStorage[key] = value
      },
    },
    configurable: true,
  })
  Object.defineProperty(globalThis, "sessionStorage", {
    value: {
      clear: () => {
        for (const key of Object.keys(mockSessionStorage)) {
          delete mockSessionStorage[key]
        }
      },
      getItem: (key: string) => mockSessionStorage[key] ?? null,
      removeItem: (key: string) => {
        delete mockSessionStorage[key]
      },
      setItem: (key: string, value: string) => {
        sessionWrites.push([key, value])
        mockSessionStorage[key] = value
      },
    },
    configurable: true,
  })
  localStorage.clear()
  sessionStorage.clear()
  for (const key of Object.keys(mockCookies)) {
    delete mockCookies[key]
  }
  Object.defineProperty(document, "cookie", {
    get: () =>
      Object.entries(mockCookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    set: (value: string) => {
      cookieWrites.push(value)
      const [keyValue] = value.split(";")
      const [key, val] = keyValue!.split("=")
      if (key && val) {
        mockCookies[key.trim()] = val.trim()
      }
    },
    configurable: true,
  })
})

afterEach(async () => {
  for (const client of clients.splice(0)) {
    await client.shutdown()
  }
  vi.restoreAllMocks()
})

describe("autoTrack auto mode", () => {
  it("enables tracking when bootstrap reports consent not required", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(bootstrapResponse({ country: "US", consentRequired: false }))

    const outlit = newOutlit({ publicKey: "pk_test" })

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

    const outlit = newOutlit({ publicKey: "pk_test", apiHost: "https://edge.example.com/" })

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

    const outlit = newOutlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlit.getVisitorId()).toBeNull()
    expect(outlitStorageKeys()).toEqual([])
    expect(outlitCookieKeys()).toEqual([])
  })

  it("stays disabled on non-2xx responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    const outlit = newOutlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlitStorageKeys()).toEqual([])
    expect(outlitCookieKeys()).toEqual([])
  })

  it("stays disabled on network errors", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"))

    const outlit = newOutlit({ publicKey: "pk_test" })
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

    const outlit = newOutlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlitStorageKeys()).toEqual([])
  })

  it("stays disabled when fetch is unavailable", async () => {
    // @ts-expect-error - simulate environments without fetch
    global.fetch = undefined

    const outlit = newOutlit({ publicKey: "pk_test" })
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

      const outlit = newOutlit({ publicKey: "pk_test" })
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

    const outlit = newOutlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(global.fetch).not.toHaveBeenCalled()
    expect(outlit.isEnabled()).toBe(false)
  })

  it("enables immediately without fetching when explicit opt-in was persisted", async () => {
    global.fetch = vi.fn().mockResolvedValue(bootstrapResponse({ consentRequired: true }))
    localStorage.setItem("outlit_consent", "2")

    const outlit = newOutlit({ publicKey: "pk_test" })

    expect(outlit.isEnabled()).toBe(true)
    await settleBootstrap()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches bootstrap for legacy "1" consent values in auto mode', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(bootstrapResponse({ country: "DE", consentRequired: true }))
    localStorage.setItem("outlit_consent", "1")

    const outlit = newOutlit({ publicKey: "pk_test" })

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

    const outlit = newOutlit({ publicKey: "pk_test", autoTrack: true })

    expect(outlit.isEnabled()).toBe(true)
    await settleBootstrap()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('treats legacy "1" consent as opted-in when autoTrack is false', async () => {
    global.fetch = vi.fn().mockResolvedValue(bootstrapResponse({ consentRequired: true }))
    localStorage.setItem("outlit_consent", "1")

    const outlit = newOutlit({ publicKey: "pk_test", autoTrack: false })

    expect(outlit.isEnabled()).toBe(true)
    await settleBootstrap()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("explicit enableTracking during pending wins over a late consent-required result", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({ publicKey: "pk_test" })
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

    const outlit = newOutlit({ publicKey: "pk_test" })
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

    const outlit = newOutlit({ publicKey: "pk_test" })

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

    const outlit = newOutlit({ publicKey: "pk_test" })
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

    const outlit = newOutlit({
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

    const outlit = newOutlit({
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

    const outlit = newOutlit({ publicKey: "pk_test" })
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
    const outlit = newOutlit({ publicKey: "pk_test", autoTrack: false })

    outlit.track("dropped_event")

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Tracking not enabled"))
  })

  it.each([
    { label: "missing country", body: { consentRequired: false } },
    { label: "non-string country", body: { country: 123, consentRequired: false } },
    { label: "null body", body: null },
    { label: "array body", body: [{ country: "US", consentRequired: false }] },
    { label: "string body", body: "consent not required" },
  ])("stays disabled on a malformed bootstrap body ($label)", async ({ body }) => {
    global.fetch = vi.fn().mockResolvedValue(bootstrapResponse(body))

    const outlit = newOutlit({ publicKey: "pk_test" })
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlit.getVisitorId()).toBeNull()
    expect(outlitStorageKeys()).toEqual([])
    expect(outlitCookieKeys()).toEqual([])
    expect(outlitSessionKeys()).toEqual([])
  })

  it("enables when bootstrap returns a null country with consent not required", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(bootstrapResponse({ country: null, consentRequired: false }))

    const outlit = newOutlit({ publicKey: "pk_test" })
    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))
  })

  it("stays disabled when an opt-out is persisted during the pending window", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })
    outlit.track("pre_verdict")

    // Another tab/instance records an explicit opt-out while the check is in flight
    localStorage.setItem("outlit_consent", "0")

    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await settleBootstrap()

    expect(outlit.isEnabled()).toBe(false)
    expect(outlit.getVisitorId()).toBeNull()

    // The buffered call is dropped — a later explicit opt-in must not send it
    outlit.enableTracking()
    await outlit.flush()
    const events = eventPayloads().flatMap((p) => p.events)
    expect(events.some((e) => e.eventName === "pre_verdict")).toBe(false)
  })

  it("a throwing listener cannot abort enable replay or the disable opt-out write", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const outlit = newOutlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })
    const calls: boolean[] = []
    outlit.onTrackingStateChange(() => {
      throw new Error("listener boom")
    })
    outlit.onTrackingStateChange((enabled) => calls.push(enabled))

    outlit.track("buffered_event")
    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))

    // Later listeners still run and the throw is logged
    expect(calls).toEqual([true])
    expect(warn.mock.calls.some(([msg]) => String(msg).includes("listener threw"))).toBe(true)

    // Buffer replay completed before listeners ran
    await outlit.flush()
    const events = eventPayloads().flatMap((p) => p.events)
    expect(events.some((e) => e.eventName === "buffered_event")).toBe(true)

    // Explicit enable still records opt-in
    outlit.enableTracking()
    expect(localStorage.getItem("outlit_consent")).toBe("2")

    // The "0" write is not blocked by the throwing listener
    await outlit.disableTracking()
    expect(localStorage.getItem("outlit_consent")).toBe("0")
    expect(calls).toEqual([true, false])
  })

  it("replays identify → clearUser → track in call order", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })

    outlit.identify({ email: "a@example.com" })
    outlit.clearUser()
    outlit.track("after_clear")

    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))
    await outlit.flush()

    const payloads = eventPayloads()
    expect(payloads).toHaveLength(2)
    // The identify went out attributed to A...
    expect(payloads[0]?.events).toEqual([
      expect.objectContaining({ type: "identify", email: "a@example.com" }),
    ])
    expect(payloads[0]?.userIdentity).toEqual({ email: "a@example.com" })
    // ...then the clear landed, so the track event is attributed to nobody
    expect(payloads[1]?.events).toEqual([
      expect.objectContaining({ type: "custom", eventName: "after_clear" }),
    ])
    expect(payloads[1]?.userIdentity).toBeUndefined()
  })

  it("replays an earlier buffered identify before a later setUser", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })

    outlit.identify({ email: "a@example.com" })
    outlit.setUser({ email: "b@example.com" })

    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))
    await outlit.flush()

    const payloads = eventPayloads()
    expect(payloads).toHaveLength(2)
    expect(payloads[0]?.events).toEqual([
      expect.objectContaining({ type: "identify", email: "a@example.com" }),
    ])
    expect(payloads[0]?.userIdentity).toEqual({ email: "a@example.com" })
    expect(payloads[1]?.events).toEqual([
      expect.objectContaining({ type: "identify", email: "b@example.com" }),
    ])
    expect(payloads[1]?.userIdentity).toEqual({ email: "b@example.com" })
  })

  it("keeps the latest setUser identity on a consent-required verdict but drops track/identify", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })

    outlit.setUser({ email: "first@example.com" })
    outlit.identify({ email: "other@example.com" })
    outlit.track("dropped_event")
    outlit.setUser({ email: "latest@example.com" })

    pending.resolve(bootstrapResponse({ country: "DE", consentRequired: true }))
    await settleBootstrap()
    expect(outlit.isEnabled()).toBe(false)

    // Only the latest setUser survives — like autoTrack: false pendingUser
    outlit.enableTracking()
    await outlit.flush()

    const events = eventPayloads().flatMap((p) => p.events)
    expect(events).toEqual([
      expect.objectContaining({ type: "identify", email: "latest@example.com" }),
    ])
  })

  it("replays buffered calls with their call-time url, timestamp, and properties", async () => {
    window.history.pushState({}, "", "/pricing")
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    const properties: Record<string, string> = { plan: "pro" }
    outlit.track("viewed_pricing", properties)
    nowSpy.mockRestore()

    window.history.pushState({}, "", "/checkout")
    properties.plan = "enterprise"
    properties.extra = "late"

    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))
    await outlit.flush()
    window.history.pushState({}, "", "/")

    const event = eventPayloads()
      .flatMap((p) => p.events)
      .find((e) => e.type === "custom")
    expect(event?.url).toBe("http://localhost:3000/pricing")
    expect(event?.properties).toEqual({ plan: "pro" })
    expect(event?.timestamp).toBe(1_700_000_000_000)
  })

  it("writes nothing while pending — even across navigation and form submits", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({ publicKey: "pk_test" })

    // Exercise a pageview navigation and a form submit during the pending window
    window.history.pushState({}, "", "/checkout")
    const form = document.createElement("form")
    const input = document.createElement("input")
    input.name = "email"
    input.value = "pending@example.com"
    form.appendChild(input)
    document.body.appendChild(form)
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    document.body.removeChild(form)
    outlit.track("pending_call")

    expect(localWrites).toEqual([])
    expect(sessionWrites).toEqual([])
    expect(cookieWrites).toEqual([])

    pending.resolve(bootstrapResponse({ country: "DE", consentRequired: true }))
    await settleBootstrap()
    window.history.pushState({}, "", "/")

    expect(outlit.isEnabled()).toBe(false)
    expect(localWrites).toEqual([])
    expect(sessionWrites).toEqual([])
    expect(cookieWrites).toEqual([])
    expect(eventPayloads()).toEqual([])
  })

  it("bounds the pending-call buffer at 100, dropping the oldest calls", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })

    for (let i = 0; i < 101; i++) {
      outlit.track(`event_${i}`)
    }

    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))
    await outlit.flush()

    const names = eventPayloads()
      .flatMap((p) => p.events)
      .filter((e) => e.type === "custom")
      .map((e) => e.eventName)
    expect(names).toHaveLength(100)
    expect(names[0]).toBe("event_1")
    expect(names.at(-1)).toBe("event_100")
    expect(names).not.toContain("event_0")
  })

  it("keeps the newest identity when the pending buffer overflows", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })

    // 102 calls: the cap must evict plain tracks, never the identity calls —
    // a dropped setUser would otherwise resurrect a stale identity on replay
    outlit.setUser({ email: "a@example.com" })
    for (let i = 0; i < 99; i++) {
      outlit.track(`filler_${i}`)
    }
    outlit.identify({ email: "b@example.com" })
    outlit.track("last_call")

    pending.resolve(bootstrapResponse({ country: "US", consentRequired: false }))
    await vi.waitFor(() => expect(outlit.isEnabled()).toBe(true))
    await outlit.flush()

    const payloads = eventPayloads()
    const events = payloads.flatMap((p) => p.events)
    // filler_0 and filler_1 were evicted; both identity calls survived — a
    // resurrected pendingUser would enqueue a third identify for A
    expect(events).toHaveLength(100)
    const names = events.filter((e) => e.type === "custom").map((e) => e.eventName)
    expect(names).not.toContain("filler_0")
    expect(names).not.toContain("filler_1")
    expect(names[0]).toBe("filler_2")
    expect(names.at(-1)).toBe("last_call")
    expect(events.filter((e) => e.type === "identify").map((e) => e.email)).toEqual([
      "a@example.com",
      "b@example.com",
    ])

    // Events made after the replay attribute to B — the evicted setUser must
    // not come back through the pendingUser fallback
    outlit.track("after_enable")
    await outlit.flush()
    const lastPayload = eventPayloads().at(-1)
    expect(lastPayload?.userIdentity).toEqual({ email: "b@example.com" })
    expect(lastPayload?.events.filter((e) => e.type === "identify")).toEqual([])
  })

  it("a trailing buffered clearUser clears pendingUser on a consent-required verdict", async () => {
    const pending = deferred<unknown>()
    global.fetch = vi.fn().mockReturnValue(pending.promise)

    const outlit = newOutlit({
      publicKey: "pk_test",
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })

    outlit.setUser({ email: "a@example.com" })
    outlit.clearUser()

    pending.resolve(bootstrapResponse({ country: "DE", consentRequired: true }))
    await settleBootstrap()
    expect(outlit.isEnabled()).toBe(false)

    // The clear wins over the earlier setUser — a later explicit opt-in sends
    // no identify at all
    outlit.enableTracking()
    await outlit.flush()
    expect(
      eventPayloads()
        .flatMap((p) => p.events)
        .filter((e) => e.type === "identify"),
    ).toEqual([])
  })

  it("shutting down a pending client leaves an enabled client's capture running", async () => {
    const pending = deferred<Response>()
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (url.includes("/bootstrap")) return pending.promise
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)
    })

    // The enabled client owns the shared capture hooks (pushState patch etc.)
    const enabled = newOutlit({
      publicKey: "pk_live",
      autoTrack: true,
      trackForms: false,
      trackEngagement: false,
      trackCalendarEmbeds: false,
    })
    // Still waiting on its auto-mode verdict — owns no shared resources
    const pendingClient = newOutlit({ publicKey: "pk_pending" })

    await pendingClient.shutdown()

    // Pageview capture is delayed ~10ms after navigation for title updates
    window.history.pushState({}, "", "/still-captured")
    await new Promise((resolve) => setTimeout(resolve, 20))
    await enabled.flush()
    window.history.pushState({}, "", "/")

    const urls = eventPayloads()
      .flatMap((p) => p.events)
      .filter((e) => e.type === "pageview")
      .map((e) => e.url)
    expect(urls).toContain("http://localhost:3000/still-captured")
  })
})
