import { type ExtractedIdentity, extractIdentityFromForm, sanitizeFormFields } from "@outlit/core"

// ============================================
// PAGEVIEW TRACKING
// ============================================

type PageviewCallback = (url: string, referrer: string, title: string) => void

let pageviewCallback: PageviewCallback | null = null
let lastUrl: string | null = null

/**
 * Initialize automatic pageview tracking.
 * Captures initial pageview and listens for SPA navigation.
 */
export function initPageviewTracking(callback: PageviewCallback): void {
  pageviewCallback = callback

  // Capture initial pageview
  capturePageview()

  // Listen for SPA navigation
  setupSpaListeners()
}

/**
 * Capture a pageview event.
 */
function capturePageview(): void {
  if (!pageviewCallback) return

  const url = window.location.href
  const referrer = document.referrer
  const title = document.title

  // Avoid duplicate pageviews for the same URL
  if (url === lastUrl) return
  lastUrl = url

  pageviewCallback(url, referrer, title)
}

/**
 * Set up listeners for SPA navigation.
 */
function setupSpaListeners(): void {
  // Listen for popstate (browser back/forward)
  window.addEventListener("popstate", () => {
    capturePageview()
  })

  // Monkey-patch pushState and replaceState
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    capturePageview()
  }

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args)
    capturePageview()
  }
}

// ============================================
// FORM TRACKING
// ============================================

type FormCallback = (
  url: string,
  formId: string | undefined,
  fields: Record<string, string>,
) => void

type IdentityCallback = (identity: ExtractedIdentity) => void

let formCallback: FormCallback | null = null
let formDenylist: string[] | undefined
let identityCallback: IdentityCallback | null = null

/**
 * Initialize automatic form tracking.
 * Captures form submissions with field sanitization.
 *
 * @param callback - Called when a form is submitted with sanitized fields
 * @param denylist - Optional list of field names to exclude
 * @param onIdentity - Optional callback for auto-identification when email is found
 */
export function initFormTracking(
  callback: FormCallback,
  denylist?: string[],
  onIdentity?: IdentityCallback,
): void {
  formCallback = callback
  formDenylist = denylist
  identityCallback = onIdentity ?? null

  // Listen for form submissions
  document.addEventListener("submit", handleFormSubmit, true)
}

/**
 * Handle form submission events.
 */
function handleFormSubmit(event: Event): void {
  if (!formCallback) return

  const form = event.target as HTMLFormElement
  if (!(form instanceof HTMLFormElement)) return

  const url = window.location.href
  const formId = form.id || form.name || undefined

  // Extract form fields and input types
  const formData = new FormData(form)
  const fields: Record<string, string> = {}
  const inputTypes = new Map<string, string>()

  // Get input types for better email detection
  const inputs = form.querySelectorAll("input, select, textarea")
  for (const input of inputs) {
    const name = input.getAttribute("name")
    if (name && input instanceof HTMLInputElement) {
      inputTypes.set(name, input.type)
    }
  }

  formData.forEach((value, key) => {
    // Only capture string values, skip files
    if (typeof value === "string") {
      fields[key] = value
    }
  })

  // Sanitize fields to remove sensitive data
  const sanitizedFields = sanitizeFormFields(fields, formDenylist)

  // Auto-identify if callback is set and we find identity fields
  // Use unsanitized fields for identity extraction (email might be in there)
  if (identityCallback) {
    const identity = extractIdentityFromForm(fields, inputTypes)
    if (identity) {
      identityCallback(identity)
    }
  }

  // Emit form event (with sanitized fields)
  if (sanitizedFields && Object.keys(sanitizedFields).length > 0) {
    formCallback(url, formId, sanitizedFields)
  }
}

// ============================================
// CLEANUP
// ============================================

/**
 * Stop all autocapture tracking.
 */
export function stopAutocapture(): void {
  pageviewCallback = null
  formCallback = null
  identityCallback = null
  document.removeEventListener("submit", handleFormSubmit, true)
}
