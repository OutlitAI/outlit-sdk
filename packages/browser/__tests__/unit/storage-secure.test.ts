/**
 * @vitest-environment-options {"url": "https://www.example.com/"}
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getOrCreateVisitorId, setConsentState } from "../../src/storage"

const writes: string[] = []
let originalCookieDescriptor: PropertyDescriptor | undefined

beforeEach(() => {
  localStorage.clear()
  writes.length = 0
  originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")
  Object.defineProperty(document, "cookie", {
    get: () => "",
    set: (value: string) => {
      writes.push(value)
    },
    configurable: true,
  })
})

afterEach(() => {
  // Drop the instance override so the prototype's accessor applies again
  Reflect.deleteProperty(document, "cookie")
  if (originalCookieDescriptor) {
    Object.defineProperty(Document.prototype, "cookie", originalCookieDescriptor)
  }
})

describe("cookies on HTTPS pages", () => {
  it("marks the consent and visitor ID cookies Secure", () => {
    setConsentState(true)
    getOrCreateVisitorId()

    expect(writes).toHaveLength(2)
    for (const cookie of writes) {
      expect(cookie).toContain(";SameSite=Lax")
      expect(cookie).toContain(";domain=example.com")
      expect(cookie).toContain(";Secure")
    }
  })
})
