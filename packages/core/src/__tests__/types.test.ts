import { describe, expect, expectTypeOf, it } from "vitest"
import { buildStageEvent } from "../payload"
import type {
  BrowserIdentifyOptions,
  CustomerTraits,
  IdentifyTraits,
  ServerIdentifyOptions,
  ServerTrackOptions,
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

describe("StageEvent", () => {
  it("includes an eventName for activation ingestion", () => {
    const event = buildStageEvent({
      url: "https://example.com/onboarding",
      stage: "activated",
    })

    expect(event.type).toBe("stage")
    expect(event.stage).toBe("activated")
    expect(event.eventName).toBe("activated")
  })
})
