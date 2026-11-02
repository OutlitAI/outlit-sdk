/**
 * @vitest-environment-options {"url": "https://www.example.com/pricing"}
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getFirstPartyCookieDomain, getOrCreateVisitorId } from "../../src/storage"
import { Outlit } from "../../src/tracker"

const KEY = "outlit_visitor_id"
const SHARED_ID = "11111111-1111-4111-8111-111111111111"
const LOCAL_ID = "22222222-2222-4222-8222-222222222222"

// Raw cookie header the page sees, and every cookie string the SDK writes
let cookieHeader = ""
const writes: string[] = []

beforeEach(() => {
  localStorage.clear()
  cookieHeader = ""
  writes.length = 0
  Object.defineProperty(document, "cookie", {
    get: () => cookieHeader,
    set: (value: string) => {
      writes.push(value)
    },
    configurable: true,
  })
  global.fetch = vi.fn().mockResolvedValue({ ok: true })
})

afterEach(() => {
  Reflect.deleteProperty(document, "cookie")
  vi.restoreAllMocks()
})

function visitorCookieWrites(): string[] {
  return writes.filter((cookie) => cookie.startsWith(`${KEY}=`))
}

describe("getOrCreateVisitorId", () => {
  it("prefers the shared root-domain cookie over this subdomain's localStorage", () => {
    cookieHeader = `${KEY}=${SHARED_ID}`
    localStorage.setItem(KEY, LOCAL_ID)

    expect(getOrCreateVisitorId()).toBe(SHARED_ID)
    expect(localStorage.getItem(KEY)).toBe(SHARED_ID)
  })

  it("restores an expired cookie from localStorage", () => {
    localStorage.setItem(KEY, LOCAL_ID)

    expect(getOrCreateVisitorId()).toBe(LOCAL_ID)
    expect(visitorCookieWrites()).toEqual([expect.stringContaining(`${KEY}=${LOCAL_ID};`)])
  })

  it("refreshes the cookie expiry on every call", () => {
    cookieHeader = `${KEY}=${SHARED_ID}`

    getOrCreateVisitorId()
    getOrCreateVisitorId()

    const cookies = visitorCookieWrites()
    expect(cookies).toHaveLength(2)
    for (const cookie of cookies) {
      expect(cookie).toContain(`${KEY}=${SHARED_ID};expires=`)
      expect(cookie).toContain(";domain=example.com")
    }
  })

  it("doesn't overwrite a server-set cookie when a first-party proxy refreshes it", () => {
    cookieHeader = `${KEY}=${SHARED_ID}`

    expect(getOrCreateVisitorId({ serverSetsCookie: true })).toBe(SHARED_ID)
    expect(visitorCookieWrites()).toEqual([])
    expect(localStorage.getItem(KEY)).toBe(SHARED_ID)
  })

  it("still restores a missing cookie when a first-party proxy is used", () => {
    localStorage.setItem(KEY, LOCAL_ID)

    getOrCreateVisitorId({ serverSetsCookie: true })

    expect(visitorCookieWrites()).toEqual([expect.stringContaining(`${KEY}=${LOCAL_ID};`)])
  })

  it("ignores a malformed cookie and falls back to localStorage", () => {
    cookieHeader = `${KEY}=not-a-uuid`
    localStorage.setItem(KEY, LOCAL_ID)

    expect(getOrCreateVisitorId()).toBe(LOCAL_ID)
  })

  it("reads the first of duplicate cookies with the same name", () => {
    cookieHeader = `other=1; ${KEY}=${SHARED_ID}; ${KEY}=${LOCAL_ID}`

    expect(getOrCreateVisitorId()).toBe(SHARED_ID)
  })

  it("mints and persists a new ID when no copy exists", () => {
    const visitorId = getOrCreateVisitorId()

    expect(localStorage.getItem(KEY)).toBe(visitorId)
    expect(visitorCookieWrites()).toEqual([expect.stringContaining(`${KEY}=${visitorId};`)])
  })
})

describe("getFirstPartyCookieDomain", () => {
  it.each([
    ["https://www.example.com/_o", "example.com"],
    ["/_o", "example.com"],
    ["https://t.example.com", "example.com"],
    ["https://example.com", "example.com"],
  ])("returns the root domain for same-site API host %s", (apiHost, expected) => {
    expect(getFirstPartyCookieDomain(apiHost)).toBe(expected)
  })

  it.each([
    "https://app.outlit.ai",
    "https://notexample.com",
    "https://example.com.evil.io",
  ])("returns null for third-party API host %s", (apiHost) => {
    expect(getFirstPartyCookieDomain(apiHost)).toBeNull()
  })
})

describe("ingest requests", () => {
  async function sendOneEvent(apiHost?: string) {
    const outlit = new Outlit({
      publicKey: "pk_test",
      apiHost,
      autoTrack: false,
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
    })
    outlit.enableTracking()
    outlit.track("pricing_viewed")
    await outlit.flush()
    await outlit.shutdown()
    return vi.mocked(global.fetch).mock.calls.at(-1)!
  }

  it("asks a first-party proxy to set the visitor cookie, with credentials", async () => {
    const [url, init] = await sendOneEvent("https://www.example.com/_o")

    expect(url).toBe("https://www.example.com/_o/api/i/v1/pk_test/events?cookie_domain=example.com")
    expect(init?.credentials).toBe("include")
  })

  it("leaves third-party ingest requests unchanged", async () => {
    const [url, init] = await sendOneEvent()

    expect(url).toBe("https://app.outlit.ai/api/i/v1/pk_test/events")
    expect(init?.credentials).toBeUndefined()
  })
})
