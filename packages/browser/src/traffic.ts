import type { IngestPayload } from "@outlit/core"

// ============================================
// TRAFFIC HINT
// ============================================

/**
 * Client-side signals that the browser is automated. Outlit classifies every
 * event server-side from the User-Agent (human, ai_agent, crawler,
 * automation); this hint only adds what the server can't see.
 */
export type TrafficHint = NonNullable<IngestPayload["traffic"]>
type TrafficSignal = TrafficHint["signals"][number]

interface NavigatorWithUAData extends Navigator {
  userAgentData?: { brands?: Array<{ brand: string }> }
}

/**
 * Detect automation signals: navigator.webdriver (Playwright, Puppeteer,
 * Selenium) and headless Chrome (user agent or client-hint brands).
 * Returns undefined for a regular browser.
 */
export function getTrafficHint(): TrafficHint | undefined {
  if (typeof navigator === "undefined") return undefined

  const nav = navigator as NavigatorWithUAData
  const signals: TrafficSignal[] = []
  if (nav.webdriver === true) signals.push("webdriver")
  if (
    /HeadlessChrome/.test(nav.userAgent ?? "") ||
    nav.userAgentData?.brands?.some(({ brand }) => brand === "HeadlessChrome")
  ) {
    signals.push("headless")
  }

  return signals.length > 0 ? { class: "automation", signals } : undefined
}
