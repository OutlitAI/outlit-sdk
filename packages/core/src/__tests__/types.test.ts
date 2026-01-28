import { describe, expectTypeOf, it } from "vitest"
import type {
  BrowserIdentifyOptions,
  CustomerTraits,
  IdentifyTraits,
  ServerIdentifyOptions,
} from "../types"

describe("CustomerTraits", () => {
  it("accepts plan property", () => {
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
  it("accepts flat traits (backward compat)", () => {
    const traits: IdentifyTraits = {
      name: "John",
      age: 30,
    }
    expectTypeOf(traits).toMatchTypeOf<IdentifyTraits>()
  })

  it("accepts nested customer traits", () => {
    const traits: IdentifyTraits = {
      name: "John",
      customer: {
        plan: "enterprise",
        seats: 50,
      },
    }
    expectTypeOf(traits).toMatchTypeOf<IdentifyTraits>()
  })
})

describe("ServerIdentifyOptions", () => {
  it("accepts IdentifyTraits in traits field", () => {
    const options: ServerIdentifyOptions = {
      email: "user@example.com",
      traits: {
        name: "John",
        customer: { plan: "pro" },
      },
    }
    expectTypeOf(options).toMatchTypeOf<ServerIdentifyOptions>()
  })
})

describe("BrowserIdentifyOptions", () => {
  it("accepts IdentifyTraits in traits field", () => {
    const options: BrowserIdentifyOptions = {
      email: "user@example.com",
      traits: {
        name: "John",
        customer: { plan: "pro" },
      },
    }
    expectTypeOf(options).toMatchTypeOf<BrowserIdentifyOptions>()
  })
})
