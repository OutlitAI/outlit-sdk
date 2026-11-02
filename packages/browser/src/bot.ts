// ============================================
// BOT DETECTION
// ============================================

/**
 * Self-declared crawlers that execute JavaScript (search engines, AI crawlers,
 * link unfurlers, performance audits) plus headless browsers. Deliberately
 * compact: Outlit's ingest runs a complete user-agent list server-side, so the
 * SDK only needs to stop the high-volume cases before they hit the network.
 * No lookbehind — it is a syntax error in older Safari.
 */
const BOT_USER_AGENT =
  /bot(?:[\s/;)_-]|$)|crawl|spider|slurp|lighthouse|headless|facebookexternalhit|bingpreview|mediapartners|google-inspectiontool|prerender|phantomjs/i

// Real phones whose model name ends in "bot" (e.g. "CUBOT X19 Build/...")
const BOT_LOOKALIKE_DEVICE = /cubot/i

interface NavigatorWithUAData extends Navigator {
  userAgentData?: { brands?: Array<{ brand: string }> }
}

/**
 * Whether this browser looks like a crawler or an automated browser
 * (Playwright, Puppeteer, Selenium set navigator.webdriver).
 */
export function isLikelyBot(): boolean {
  if (typeof navigator === "undefined") return false

  const nav = navigator as NavigatorWithUAData
  if (nav.webdriver === true) return true
  if (nav.userAgentData?.brands?.some(({ brand }) => /headless/i.test(brand))) return true

  const userAgent = nav.userAgent ?? ""
  return BOT_USER_AGENT.test(userAgent) && !BOT_LOOKALIKE_DEVICE.test(userAgent)
}
