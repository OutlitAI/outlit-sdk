import { describe, expect, it } from "vitest"
import { buildCustomEvent, buildIdentifyEvent, buildIngestPayload } from "../payload"
import { validateCustomerIdentity, validateServerIdentity } from "../utils"

describe("customer identity contract", () => {
  it("allows customer-only server tracking", () => {
    expect(() =>
      validateServerIdentity(undefined, undefined, undefined, "cust_123", "acme.com"),
    ).not.toThrow()

    const event = buildCustomEvent({
      url: "server://acme.com",
      eventName: "account_synced",
      customerId: "cust_123",
      customerDomain: "acme.com",
    })

    expect(event.customerId).toBe("cust_123")
    expect(event.customerDomain).toBe("acme.com")
  })

  it("keeps identify user-scoped while allowing customer metadata", () => {
    const event = buildIdentifyEvent({
      url: "server://user@example.com",
      email: "user@example.com",
      userId: "usr_123",
      customerId: "cust_123",
      customerDomain: "acme.com",
      customerTraits: {
        plan: "enterprise",
        seats: 50,
      },
      traits: {
        name: "Jane Doe",
      },
    })

    expect(event.email).toBe("user@example.com")
    expect(event.userId).toBe("usr_123")
    expect(event.customerId).toBe("cust_123")
    expect(event.customerDomain).toBe("acme.com")
    expect(event.customerTraits?.plan).toBe("enterprise")
  })

  it("includes customer context in payload-level user identity", () => {
    const payload = buildIngestPayload(
      "visitor_123",
      "client",
      [],
      {
        email: "user@example.com",
        userId: "usr_123",
        customerId: "cust_123",
        customerDomain: "acme.com",
        customerTraits: { plan: "pro" },
        traits: { name: "Jane Doe" },
      },
      "session_123",
    )

    expect(payload.userIdentity?.customerId).toBe("cust_123")
    expect(payload.userIdentity?.customerDomain).toBe("acme.com")
    expect(payload.userIdentity?.customerTraits?.plan).toBe("pro")
    expect(payload.sessionId).toBe("session_123")
  })

  it("requires a customer identifier for billing", () => {
    expect(() => validateCustomerIdentity()).toThrow()
    expect(() =>
      validateCustomerIdentity("cust_123", undefined, undefined, undefined),
    ).not.toThrow()
    expect(() =>
      validateCustomerIdentity(undefined, "acme.com", undefined, undefined),
    ).not.toThrow()
  })
})
