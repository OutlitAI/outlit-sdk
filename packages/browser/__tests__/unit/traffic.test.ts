import { afterEach, describe, expect, it, vi } from "vitest"
import { Outlit } from "../../src/tracker"
import { getTrafficHint } from "../../src/traffic"

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
const HEADLESS_CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36"
const GOOGLEBOT =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/141.0.0.0 Safari/537.36"

function stubNavigator(overrides: {
  userAgent?: string
  webdriver?: boolean
  brands?: Array<{ brand: string }>
}) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(overrides.userAgent ?? CHROME)
  Object.defineProperty(navigator, "webdriver", {
    value: overrides.webdriver ?? false,
    configurable: true,
  })
  Object.defineProperty(navigator, "userAgentData", {
    value: overrides.brands ? { brands: overrides.brands } : undefined,
    configurable: true,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, "webdriver")
  Reflect.deleteProperty(navigator, "userAgentData")
})

describe("getTrafficHint", () => {
  it("returns nothing for a regular browser", () => {
    stubNavigator({})
    expect(getTrafficHint()).toBeUndefined()
  })

  it("leaves crawler classification to the server", () => {
    stubNavigator({ userAgent: GOOGLEBOT })
    expect(getTrafficHint()).toBeUndefined()
  })

  it("flags navigator.webdriver", () => {
    stubNavigator({ webdriver: true })
    expect(getTrafficHint()).toEqual({ class: "automation", signals: ["webdriver"] })
  })

  it("flags headless Chrome from the user agent", () => {
    stubNavigator({ userAgent: HEADLESS_CHROME })
    expect(getTrafficHint()).toEqual({ class: "automation", signals: ["headless"] })
  })

  it("flags headless Chrome from client-hint brands", () => {
    stubNavigator({ webdriver: true, brands: [{ brand: "HeadlessChrome" }, { brand: "Chromium" }] })
    expect(getTrafficHint()).toEqual({ class: "automation", signals: ["webdriver", "headless"] })
  })
})

describe("ingest payload traffic hint", () => {
  async function sentPayload(): Promise<Record<string, unknown>> {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    const outlit = new Outlit({
      publicKey: "pk_test",
      autoTrack: true,
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
    })
    outlit.track("pricing_viewed")
    await outlit.flush()
    await outlit.shutdown()
    const init = vi.mocked(global.fetch).mock.calls[0]?.[1]
    return JSON.parse(String(init?.body))
  }

  it("sends events from automated browsers with the hint", async () => {
    stubNavigator({ webdriver: true })
    const payload = await sentPayload()

    expect(payload.traffic).toEqual({ class: "automation", signals: ["webdriver"] })
    expect(payload.events).toHaveLength(1)
  })

  it("omits the hint for regular browsers", async () => {
    stubNavigator({})
    const payload = await sentPayload()

    expect(payload).not.toHaveProperty("traffic")
    expect(payload.events).toHaveLength(1)
  })
})
