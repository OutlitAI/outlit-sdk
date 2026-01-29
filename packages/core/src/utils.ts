import { DEFAULT_DENIED_FORM_FIELDS, type UtmParams } from "./types"

// ============================================
// UTM EXTRACTION
// ============================================

/**
 * Extract UTM parameters from a URL.
 */
export function extractUtmParams(url: string): UtmParams | undefined {
  try {
    const urlObj = new URL(url)
    const params = urlObj.searchParams

    const utm: UtmParams = {}

    if (params.has("utm_source")) utm.source = params.get("utm_source") ?? undefined
    if (params.has("utm_medium")) utm.medium = params.get("utm_medium") ?? undefined
    if (params.has("utm_campaign")) utm.campaign = params.get("utm_campaign") ?? undefined
    if (params.has("utm_term")) utm.term = params.get("utm_term") ?? undefined
    if (params.has("utm_content")) utm.content = params.get("utm_content") ?? undefined

    return Object.keys(utm).length > 0 ? utm : undefined
  } catch (error) {
    console.warn(`[Outlit] Failed to parse URL for UTM extraction: "${url}"`, error)
    return undefined
  }
}

/**
 * Extract path from a URL.
 */
export function extractPathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname
  } catch (error) {
    console.warn(
      `[Outlit] Failed to parse URL for path extraction: "${url}", defaulting to "/"`,
      error,
    )
    return "/"
  }
}

// ============================================
// FORM FIELD SANITIZATION
// ============================================

/**
 * Check if a field name should be denied (case-insensitive).
 */
export function isFieldDenied(fieldName: string, denylist: string[]): boolean {
  const normalizedName = fieldName.toLowerCase().replace(/[-_\s]/g, "")
  return denylist.some((denied) => {
    const normalizedDenied = denied.toLowerCase().replace(/[-_\s]/g, "")
    return normalizedName.includes(normalizedDenied)
  })
}

/**
 * Check if a value looks like sensitive data (e.g., credit card number).
 */
function looksLikeSensitiveValue(value: string): boolean {
  // Remove spaces and dashes
  const cleaned = value.replace(/[\s-]/g, "")

  // Check for credit card patterns (13-19 digits)
  if (/^\d{13,19}$/.test(cleaned)) {
    return true
  }

  // Check for SSN pattern (9 digits)
  if (/^\d{9}$/.test(cleaned) || /^\d{3}-\d{2}-\d{4}$/.test(value)) {
    return true
  }

  return false
}

/**
 * Sanitize form fields by removing sensitive data.
 * Returns a new object with denied fields removed.
 */
export function sanitizeFormFields(
  fields: Record<string, string> | undefined,
  customDenylist?: string[],
): Record<string, string> | undefined {
  if (!fields) return undefined

  const denylist = customDenylist ?? DEFAULT_DENIED_FORM_FIELDS
  const sanitized: Record<string, string> = {}

  for (const [key, value] of Object.entries(fields)) {
    if (!isFieldDenied(key, denylist)) {
      // Also check for credit card patterns in values
      if (!looksLikeSensitiveValue(value)) {
        sanitized[key] = value
      }
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

// ============================================
// VISITOR ID DERIVATION (for server SDK)
// ============================================

/**
 * Derive a deterministic visitor ID from email and/or userId.
 * This is used by the server SDK to create consistent IDs for API compatibility.
 *
 * Uses a simple hash to create a UUID-like string that will be consistent
 * for the same email/userId combination.
 */
export function deriveVisitorIdFromIdentity(email?: string, userId?: string): string {
  const identity = [email?.toLowerCase(), userId].filter(Boolean).join("|")
  if (!identity) {
    throw new Error("Either email or userId must be provided")
  }

  // Simple hash function to create a deterministic UUID-like string
  let hash = 0
  for (let i = 0; i < identity.length; i++) {
    const char = identity.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  // Convert to hex and format as UUID-like string
  const hex = Math.abs(hash).toString(16).padStart(8, "0")
  const part1 = hex.slice(0, 8)
  const part2 = identity.length.toString(16).padStart(4, "0")
  const part3 = "4000" // Version 4 UUID marker
  const part4 = (((hash >>> 16) & 0x0fff) | 0x8000).toString(16)
  const part5 = Math.abs(hash * 31)
    .toString(16)
    .padStart(12, "0")
    .slice(0, 12)

  return `${part1}-${part2}-${part3}-${part4}-${part5}`
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate that at least one identity field is provided.
 * Used by the server SDK to enforce identity requirements.
 *
 * Valid identities:
 * - fingerprint: Device identifier (for anonymous tracking, can be linked later)
 * - email: User's email (definitive identity)
 * - userId: App's internal user ID
 */
export function validateServerIdentity(
  fingerprint?: string,
  email?: string,
  userId?: string,
): void {
  const hasFingerprint = fingerprint && fingerprint.trim().length > 0
  const hasEmail = email && email.trim().length > 0
  const hasUserId = userId && userId.trim().length > 0

  if (!hasFingerprint && !hasEmail && !hasUserId) {
    throw new Error(
      "Server SDK requires at least one of: fingerprint, email, or userId for all track calls. " +
        "Use fingerprint for anonymous tracking that can be linked to users later via identify().",
    )
  }
}

// ============================================
// AUTO-IDENTIFY: EMAIL & NAME EXTRACTION
// ============================================

/**
 * Validate that a string looks like a valid email address.
 */
export function isValidEmail(value: string): boolean {
  if (!value || typeof value !== "string") return false
  // Basic email regex - intentionally permissive to avoid false negatives
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value.trim())
}

/**
 * Email field name patterns (case-insensitive, normalized).
 * Order matters - more specific patterns first.
 */
const EMAIL_FIELD_PATTERNS = [
  /^e?-?mail$/i,
  /^email[_-]?address$/i,
  /^user[_-]?email$/i,
  /^work[_-]?email$/i,
  /^contact[_-]?email$/i,
  /^primary[_-]?email$/i,
  /^business[_-]?email$/i,
]

/**
 * Full name field patterns.
 */
const FULL_NAME_PATTERNS = [
  /^name$/i,
  /^full[_-]?name$/i,
  /^your[_-]?name$/i,
  /^customer[_-]?name$/i,
  /^contact[_-]?name$/i,
  /^display[_-]?name$/i,
]

/**
 * First name field patterns.
 */
const FIRST_NAME_PATTERNS = [
  /^first[_-]?name$/i,
  /^firstname$/i,
  /^first$/i,
  /^fname$/i,
  /^given[_-]?name$/i,
  /^forename$/i,
]

/**
 * Last name field patterns.
 */
const LAST_NAME_PATTERNS = [
  /^last[_-]?name$/i,
  /^lastname$/i,
  /^last$/i,
  /^lname$/i,
  /^surname$/i,
  /^family[_-]?name$/i,
]

/**
 * Check if a field name matches any of the given patterns.
 */
function matchesPatterns(fieldName: string, patterns: RegExp[]): boolean {
  const normalized = fieldName.trim()
  return patterns.some((pattern) => pattern.test(normalized))
}

/**
 * Find an email value from form fields.
 *
 * Priority:
 * 1. Fields with input type="email" (if inputTypes map provided)
 * 2. Field names matching email patterns
 * 3. Any field with a value that looks like an email
 *
 * @param fields - Form field key-value pairs
 * @param inputTypes - Optional map of field names to input types
 * @returns The email value if found, undefined otherwise
 */
export function findEmailField(
  fields: Record<string, string>,
  inputTypes?: Map<string, string>,
): string | undefined {
  // Priority 1: Check fields with type="email"
  if (inputTypes) {
    for (const [fieldName, inputType] of inputTypes.entries()) {
      if (inputType === "email") {
        const value = fields[fieldName]
        if (value && isValidEmail(value)) {
          return value.trim()
        }
      }
    }
  }

  // Priority 2: Check field names matching email patterns
  for (const [fieldName, value] of Object.entries(fields)) {
    if (matchesPatterns(fieldName, EMAIL_FIELD_PATTERNS) && isValidEmail(value)) {
      return value.trim()
    }
  }

  // Priority 3: Any field with email-like value (fallback)
  for (const value of Object.values(fields)) {
    if (isValidEmail(value)) {
      return value.trim()
    }
  }

  return undefined
}

/**
 * Extract name fields from form data.
 *
 * Looks for:
 * - Full name fields (name, full_name, etc.)
 * - First name fields (first_name, fname, etc.)
 * - Last name fields (last_name, lname, etc.)
 *
 * If only first/last names are found, combines them into a full name.
 *
 * @param fields - Form field key-value pairs
 * @returns Object with name, firstName, and/or lastName if found
 */
export function findNameFields(fields: Record<string, string>): {
  name?: string
  firstName?: string
  lastName?: string
} {
  let fullName: string | undefined
  let firstName: string | undefined
  let lastName: string | undefined

  for (const [fieldName, value] of Object.entries(fields)) {
    const trimmedValue = value?.trim()
    if (!trimmedValue) continue

    // Check for full name
    if (!fullName && matchesPatterns(fieldName, FULL_NAME_PATTERNS)) {
      fullName = trimmedValue
    }

    // Check for first name
    if (!firstName && matchesPatterns(fieldName, FIRST_NAME_PATTERNS)) {
      firstName = trimmedValue
    }

    // Check for last name
    if (!lastName && matchesPatterns(fieldName, LAST_NAME_PATTERNS)) {
      lastName = trimmedValue
    }
  }

  const result: { name?: string; firstName?: string; lastName?: string } = {}

  // If we have a full name, use it
  if (fullName) {
    result.name = fullName
  }
  // If we have first and last, combine them
  else if (firstName && lastName) {
    result.name = `${firstName} ${lastName}`
    result.firstName = firstName
    result.lastName = lastName
  }
  // If we only have first name
  else if (firstName) {
    result.firstName = firstName
  }
  // If we only have last name
  else if (lastName) {
    result.lastName = lastName
  }

  return result
}

/**
 * Identity extracted from a form submission.
 */
export interface ExtractedIdentity {
  email: string
  name?: string
  firstName?: string
  lastName?: string
}

/**
 * Extract identity information (email + name) from form fields.
 *
 * Returns undefined if no valid email is found (email is required for identification).
 *
 * @param fields - Form field key-value pairs
 * @param inputTypes - Optional map of field names to input types
 * @returns Extracted identity with email and optional name fields, or undefined
 */
export function extractIdentityFromForm(
  fields: Record<string, string>,
  inputTypes?: Map<string, string>,
): ExtractedIdentity | undefined {
  const email = findEmailField(fields, inputTypes)

  // Email is required for identification
  if (!email) {
    return undefined
  }

  const nameFields = findNameFields(fields)

  return {
    email,
    ...nameFields,
  }
}
