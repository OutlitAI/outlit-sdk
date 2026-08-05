import { describe, expect, expectTypeOf, it } from "vitest"
import type {
  BrowserIdentifyOptions,
  CustomerTraits,
  EventType,
  IdentifyTraits,
  PayloadUserIdentity,
  PayloadUserIdentityInput,
  ServerIdentifyOptions,
  ServerTrackOptions,
  TrackerEvent,
} from "../types"

describe("CustomerTraits", () => {
  it("accepts account-level traits", () => {
    const traits: CustomerTraits = { plan: "enterprise" }
    expectTypeOf(traits).toMatchTypeOf<CustomerTraits>()
  })

  it("accepts custom properties", () => {
    const traits: CustomerTraits = {
      plan: "pro",
      seats: 50,
      active: true,
    }
    expectTypeOf(traits).toMatchTypeOf<CustomerTraits>()
  })
})

describe("IdentifyTraits", () => {
  it("accepts flat user traits", () => {
    const traits: IdentifyTraits = {
      name: "John",
      age: 30,
    }
    expectTypeOf(traits).toMatchTypeOf<IdentifyTraits>()
  })

  it("rejects nested customer traits", () => {
    const traits: IdentifyTraits = {
      name: "John",
      // @ts-expect-error customer traits are now top-level identify fields
      customer: {
        plan: "enterprise",
      },
    }

    expect(traits).toBeDefined()
  })
})

describe("ServerTrackOptions", () => {
  it("accepts customer-only attribution", () => {
    const options: ServerTrackOptions = {
      customerId: "cust_123",
      eventName: "account_synced",
    }

    expectTypeOf(options).toMatchTypeOf<ServerTrackOptions>()
  })

  it("accepts combined user and customer attribution", () => {
    const options: ServerTrackOptions = {
      email: "user@example.com",
      userId: "usr_123",
      customerId: "cust_123",
      eventName: "subscription_created",
    }

    expectTypeOf(options).toMatchTypeOf<ServerTrackOptions>()
  })
})

describe("ServerIdentifyOptions", () => {
  it("accepts customer metadata alongside user identity", () => {
    const options: ServerIdentifyOptions = {
      email: "user@example.com",
      userId: "usr_123",
      customerId: "cust_123",
      customerTraits: {
        plan: "pro",
      },
      traits: {
        name: "John",
      },
    }

    expectTypeOf(options).toMatchTypeOf<ServerIdentifyOptions>()
  })
})

describe("BrowserIdentifyOptions", () => {
  it("accepts customer metadata alongside user identity", () => {
    const options: BrowserIdentifyOptions = {
      email: "user@example.com",
      userId: "usr_123",
      customerId: "cust_123",
      customerTraits: {
        plan: "pro",
      },
      traits: {
        name: "John",
      },
    }

    expectTypeOf(options).toMatchTypeOf<BrowserIdentifyOptions>()
  })
})

describe("payload identity wire types", () => {
  it("keeps legacy customer fields in builder input but out of the wire identity", () => {
    const input: PayloadUserIdentityInput = {
      email: "user@example.com",
      fingerprint: "device_123",
      customerId: "cust_123",
      customerTraits: { plan: "pro" },
    }
    const wireIdentity: PayloadUserIdentity = {
      email: "user@example.com",
      // @ts-expect-error customer attribution belongs in payload.customerIdentity on the wire
      customerId: "cust_123",
    }

    expect(input.customerId).toBe("cust_123")
    expect(input.fingerprint).toBe("device_123")
    expect(wireIdentity.email).toBe("user@example.com")
  })
})

describe("EventType", () => {
  it("does not accept authoritative lifecycle or billing events", () => {
    // @ts-expect-error lifecycle is derived from ordinary events
    const stage: EventType = "stage"
    // @ts-expect-error billing is sourced from verified integrations
    const billing: EventType = "billing"

    expect(stage).toBe("stage")
    expect(billing).toBe("billing")
  })

  it("has no lifecycle or billing event variants in the tracker union", () => {
    expectTypeOf<Extract<TrackerEvent, { type: "stage" }>>().toEqualTypeOf<never>()
    expectTypeOf<Extract<TrackerEvent, { type: "billing" }>>().toEqualTypeOf<never>()
  })
})
