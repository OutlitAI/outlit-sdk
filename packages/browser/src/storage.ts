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
 * Tries localStorage first, falls back to cookie.
 */
export function getOrCreateVisitorId(): string {
  // Try localStorage first
  try {
    const stored = localStorage.getItem(VISITOR_ID_KEY)
    if (stored && isValidUuid(stored)) {
      return stored
    }
  } catch {
    // localStorage not available
  }

  // Try cookie fallback
  const cookieValue = getCookie(VISITOR_ID_KEY)
  if (cookieValue && isValidUuid(cookieValue)) {
    // Also store in localStorage for consistency
    try {
      localStorage.setItem(VISITOR_ID_KEY, cookieValue)
    } catch {
      // Ignore
    }
    return cookieValue
  }

  // Generate new visitor ID
  const visitorId = generateVisitorId()
  persistVisitorId(visitorId)
  return visitorId
}

/**
 * Persist visitor ID to both localStorage and cookie.
 */
function persistVisitorId(visitorId: string): void {
  // Store in localStorage
  try {
    localStorage.setItem(VISITOR_ID_KEY, visitorId)
  } catch {
    // localStorage not available
  }

  // Also store in cookie for cross-subdomain support
  setCookie(VISITOR_ID_KEY, visitorId, 365) // 1 year
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

  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() ?? null
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

  document.cookie = cookie
}

// ============================================
// CONSENT STATE STORAGE
// ============================================

const CONSENT_KEY = "outlit_consent"

/**
 * Get the persisted consent state.
 * Returns true (opted in), false (opted out), or null (no decision recorded).
 */
export function getConsentState(): boolean | null {
  // Try localStorage first
  try {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === "1") return true
    if (stored === "0") return false
  } catch {
    // localStorage not available
  }

  // Try cookie fallback
  const cookieValue = getCookie(CONSENT_KEY)
  if (cookieValue === "1") return true
  if (cookieValue === "0") return false

  return null
}

/**
 * Persist consent state to both localStorage and cookie.
 */
export function setConsentState(granted: boolean): void {
  const value = granted ? "1" : "0"

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
