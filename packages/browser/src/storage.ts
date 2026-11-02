// ============================================
// VISITOR ID STORAGE
// ============================================

const VISITOR_ID_KEY = "outlit_visitor_id"

/**
 * Generate a UUID v4.
 * Uses crypto.randomUUID if available, otherwise falls back to manual generation.
 */
export function generateVisitorId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get the visitor ID from storage, generating a new one if needed.
 *
 * The root-domain cookie is the source of truth because it is shared across
 * subdomains (e.g. www.example.com and app.example.com); localStorage is
 * per-origin, so preferring it would pin each subdomain to its own ID. When the
 * cookie is missing (e.g. Safari ITP expired it), localStorage restores it.
 *
 * Without a first-party proxy, the cookie is rewritten on every call so its
 * expiry is refreshed on each page load — Safari caps script-set cookies at
 * 7 days, so an active visitor's ID only survives if the window keeps rolling.
 * Behind a proxy the ingest response sets the cookie with a full lifetime, so
 * the SDK writes it only when it is missing or wrong: a script write would
 * replace that server-set cookie with a 7-day one.
 */
export function getOrCreateVisitorId(options: { serverSetsCookie?: boolean } = {}): string {
  const cookieId = readCookieVisitorId()
  const visitorId = cookieId ?? readStoredVisitorId() ?? generateVisitorId()

  try {
    localStorage.setItem(VISITOR_ID_KEY, visitorId)
  } catch {
    // localStorage not available
  }

  if (!options.serverSetsCookie || cookieId !== visitorId) {
    // Root-domain cookie for cross-subdomain support
    setCookie(VISITOR_ID_KEY, visitorId, 365) // 1 year
  }

  return visitorId
}

function readCookieVisitorId(): string | null {
  const value = getCookie(VISITOR_ID_KEY)
  return value && isValidUuid(value) ? value : null
}

function readStoredVisitorId(): string | null {
  try {
    const value = localStorage.getItem(VISITOR_ID_KEY)
    return value && isValidUuid(value) ? value : null
  } catch {
    // localStorage not available
    return null
  }
}

/**
 * The cookie domain the server should set the visitor ID cookie on, when
 * `apiHost` is served from the page's own site (a first-party proxy).
 *
 * Safari ignores its 7-day cap for cookies set by an HTTP response from the
 * site's own host, so the ingest endpoint re-issues the visitor ID cookie when
 * asked. The domain must match the one the SDK writes, so both writes update
 * the same cookie. Returns null for third-party API hosts, localhost, and IPs.
 */
export function getFirstPartyCookieDomain(apiHost: string): string | null {
  const rootDomain = getRootDomain()
  if (!rootDomain) return null

  let apiHostname: string
  try {
    apiHostname = new URL(apiHost, window.location.href).hostname
  } catch {
    return null
  }

  return apiHostname === rootDomain || apiHostname.endsWith(`.${rootDomain}`) ? rootDomain : null
}

/**
 * Basic UUID validation.
 */
function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

// ============================================
// COOKIE HELPERS
// ============================================

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null

  // First match wins: browsers list more specific (longer path, older)
  // cookies first, and a duplicate name must not hide the value
  for (const part of document.cookie.split(";")) {
    const separator = part.indexOf("=")
    if (separator !== -1 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim()
    }
  }
  return null
}

/**
 * Get the root domain for cross-subdomain cookie sharing.
 * e.g., "www.example.com" → "example.com"
 *       "app.staging.example.com" → "example.com"
 *       "localhost" → null (no domain attribute needed)
 */
function getRootDomain(): string | null {
  if (typeof window === "undefined") return null

  const hostname = window.location.hostname

  // Don't set domain for localhost or IP addresses
  if (hostname === "localhost" || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return null
  }

  // Split hostname into parts
  const parts = hostname.split(".")

  // For simple domains like "example.com", return ".example.com"
  // For subdomains like "www.example.com" or "app.example.com", return ".example.com"
  if (parts.length >= 2) {
    // Handle common TLDs with two parts (e.g., .co.uk, .com.au)
    const twoPartTlds = ["co.uk", "com.au", "co.nz", "org.uk", "net.au", "com.br"]
    const lastTwo = parts.slice(-2).join(".")

    if (twoPartTlds.includes(lastTwo) && parts.length >= 3) {
      // e.g., "www.example.co.uk" → "example.co.uk"
      return parts.slice(-3).join(".")
    }

    // Standard case: "www.example.com" → "example.com"
    return parts.slice(-2).join(".")
  }

  return null
}

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === "undefined") return

  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)

  // Build cookie string
  let cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`

  // Add domain for cross-subdomain support
  const rootDomain = getRootDomain()
  if (rootDomain) {
    cookie += `;domain=${rootDomain}`
  }

  // Only send over HTTPS on secure pages; plain-HTTP pages (e.g. local dev)
  // can't set Secure cookies
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    cookie += ";Secure"
  }

  document.cookie = cookie
}

// ============================================
// CONSENT STATE STORAGE
// ============================================

const CONSENT_KEY = "outlit_consent"

// Stored values for CONSENT_KEY:
//   "0" — explicit opt-out
//   "1" — legacy opt-in: SDK versions before the consent-value change wrote
//         "1" automatically whenever tracking auto-enabled, so it does NOT
//         prove the visitor made an explicit consent decision.
//   "2" — explicit opt-in: written only when the site calls enableTracking().
const CONSENT_OPTED_OUT = "0"
const CONSENT_LEGACY_OPTED_IN = "1"
const CONSENT_OPTED_IN = "2"

/**
 * Persisted consent decision.
 * - `"opted-in"`: the site explicitly enabled tracking ("2")
 * - `"legacy-opted-in"`: auto-written by an older SDK version ("1")
 * - `"opted-out"`: the site/user explicitly disabled tracking ("0")
 * - `null`: no decision recorded
 */
export type ConsentState = "opted-in" | "legacy-opted-in" | "opted-out" | null

function readConsentValue(value: string | null): Exclude<ConsentState, null> | undefined {
  if (value === CONSENT_OPTED_IN) return "opted-in"
  if (value === CONSENT_LEGACY_OPTED_IN) return "legacy-opted-in"
  if (value === CONSENT_OPTED_OUT) return "opted-out"
  return undefined
}

/**
 * Get the persisted consent state.
 */
export function getConsentState(): ConsentState {
  // Try localStorage first
  try {
    const stored = readConsentValue(localStorage.getItem(CONSENT_KEY))
    if (stored !== undefined) return stored
  } catch {
    // localStorage not available
  }

  // Try cookie fallback
  return readConsentValue(getCookie(CONSENT_KEY)) ?? null
}

/**
 * Persist consent state to both localStorage and cookie.
 * Opt-in writes the explicit marker ("2"); opt-out writes "0".
 */
export function setConsentState(granted: boolean): void {
  const value = granted ? CONSENT_OPTED_IN : CONSENT_OPTED_OUT

  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // localStorage not available
  }

  setCookie(CONSENT_KEY, value, 365)
}

/**
 * Clear persisted consent state.
 */
export function clearConsentState(): void {
  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch {
    // localStorage not available
  }

  // Clear cookie by setting expiry in the past
  setCookie(CONSENT_KEY, "", -1)
}
