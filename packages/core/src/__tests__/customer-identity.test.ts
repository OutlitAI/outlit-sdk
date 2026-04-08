import { describe, expect, it } from "vitest"
import { buildCustomEvent, buildIdentifyEvent, buildIngestPayload } from "../payload"
import { validateCustomerIdentity, validateServerIdentity } from "../utils"

describe("customer identity contract", () => {
  it("allows customer-only server tracking", () => {
    expect(() => validateServerIdentity(undefined, undefined, undefined, "cust_123")).not.toThrow()

    const event = buildCustomEvent({
      url: "server://cust_123",
      eventName: "account_synced",
      customerId: "cust_123",
    })

    expect(event.customerId).toBe("cust_123")
    expect(event).not.toHaveProperty("customerDomain")
  })

  it("keeps identify user-scoped while allowing customer metadata", () => {
    const event = buildIdentifyEvent({
      url: "server://user@example.com",
      email: "user@example.com",
      userId: "usr_123",
      customerId: "cust_123",
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
    expect(event).not.toHaveProperty("customerDomain")
    expect(event.customerTraits?.plan).toBe("enterprise")
  })

  it("separates customer context from payload-level user identity", () => {
    const payload = buildIngestPayload(
      "visitor_123",
      "client",
      [],
      {
        email: "user@example.com",
        userId: "usr_123",
        traits: { name: "Jane Doe" },
      },
      "session_123",
      undefined,
      {
        customerId: "cust_123",
        customerTraits: { plan: "pro" },
      },
    )

    expect(payload.userIdentity).toEqual({
      email: "user@example.com",
      userId: "usr_123",
      traits: { name: "Jane Doe" },
    })
    expect(payload.customerIdentity).toEqual({
      customerId: "cust_123",
      customerTraits: { plan: "pro" },
    })
    expect(payload.sessionId).toBe("session_123")
  })

  it("lifts legacy customer fields from payload-level user identity", () => {
    const legacyUserIdentity: Parameters<typeof buildIngestPayload>[3] & {
      customerId: string
      customerTraits: { plan: string }
    } = {
      email: "legacy@example.com",
      userId: "usr_legacy",
      customerId: "cust_legacy",
      customerTraits: { plan: "legacy-pro" },
      traits: { name: "Legacy User" },
    }

    const payload = buildIngestPayload("visitor_legacy", "client", [], legacyUserIdentity)

    expect(payload.userIdentity).toEqual({
      email: "legacy@example.com",
      userId: "usr_legacy",
      traits: { name: "Legacy User" },
    })
    expect(payload.customerIdentity).toEqual({
      customerId: "cust_legacy",
      customerTraits: { plan: "legacy-pro" },
    })
  })

  it("requires a customer identifier for billing", () => {
    expect(() => validateCustomerIdentity()).toThrow()
    expect(() => validateCustomerIdentity("cust_123")).not.toThrow()
    expect(() => validateCustomerIdentity(undefined, "cus_123")).not.toThrow()
  })
})
