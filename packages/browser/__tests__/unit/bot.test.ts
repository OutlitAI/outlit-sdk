import { afterEach, describe, expect, it, vi } from "vitest"
import { isLikelyBot } from "../../src/bot"
import { Outlit } from "../../src/tracker"

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"

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

describe("isLikelyBot", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36",
  ])("flags crawler user agent %s", (userAgent) => {
    stubNavigator({ userAgent })
    expect(isLikelyBot()).toBe(true)
  })

  it.each([
    CHROME,
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 9; CUBOT X19 Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  ])("does not flag browser user agent %s", (userAgent) => {
    stubNavigator({ userAgent })
    expect(isLikelyBot()).toBe(false)
  })

  it("flags automated browsers via navigator.webdriver", () => {
    stubNavigator({ webdriver: true })
    expect(isLikelyBot()).toBe(true)
  })

  it("flags headless Chrome via client hint brands", () => {
    stubNavigator({ brands: [{ brand: "HeadlessChrome" }, { brand: "Chromium" }] })
    expect(isLikelyBot()).toBe(true)
  })
})

describe("botFilter option", () => {
  async function sendOneEvent(botFilter?: boolean) {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const outlit = new Outlit({
      publicKey: "pk_test",
      autoTrack: true,
      botFilter,
      trackPageviews: false,
      trackForms: false,
      trackEngagement: false,
    })
    outlit.track("pricing_viewed")
    await outlit.flush()
    await outlit.shutdown()
  }

  it("drops events from automated browsers by default", async () => {
    stubNavigator({ webdriver: true })
    await sendOneEvent()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("sends events from automated browsers when botFilter is false", async () => {
    stubNavigator({ webdriver: true })
    await sendOneEvent(false)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
