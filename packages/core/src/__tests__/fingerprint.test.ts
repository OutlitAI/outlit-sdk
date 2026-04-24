import { describe, expect, expectTypeOf, it } from "vitest"
import { buildCustomEvent, buildIdentifyEvent, buildIngestPayload } from "../payload"
import type {
  IdentifyEvent,
  IngestPayload,
  ServerIdentifyOptions,
  ServerIdentity,
  ServerTrackOptions,
} from "../types"
import { validateServerIdentity } from "../utils"

// ============================================
// TYPE TESTS
// ============================================

describe("ServerIdentity with fingerprint", () => {
  it("accepts fingerprint only", () => {
    const identity: ServerIdentity = { fingerprint: "device_abc123" }
    expectTypeOf(identity).toMatchTypeOf<ServerIdentity>()
  })

  it("accepts fingerprint with email", () => {
    const identity: ServerIdentity = {
      fingerprint: "device_abc123",
      email: "user@example.com",
    }
    expectTypeOf(identity).toMatchTypeOf<ServerIdentity>()
  })

  it("accepts fingerprint with userId", () => {
    const identity: ServerIdentity = {
      fingerprint: "device_abc123",
      userId: "usr_123",
    }
    expectTypeOf(identity).toMatchTypeOf<ServerIdentity>()
  })

  it("accepts all three identifiers", () => {
    const identity: ServerIdentity = {
      fingerprint: "device_abc123",
      email: "user@example.com",
      userId: "usr_123",
    }
    expectTypeOf(identity).toMatchTypeOf<ServerIdentity>()
  })
})

describe("ServerTrackOptions with fingerprint", () => {
  it("accepts fingerprint-only tracking", () => {
    const options: ServerTrackOptions = {
      fingerprint: "device_abc123",
      eventName: "page_view",
      properties: { page: "/pricing" },
    }
    expectTypeOf(options).toMatchTypeOf<ServerTrackOptions>()
  })

  it("accepts fingerprint with email", () => {
    const options: ServerTrackOptions = {
      fingerprint: "device_abc123",
      email: "user@example.com",
      eventName: "signup",
    }
    expectTypeOf(options).toMatchTypeOf<ServerTrackOptions>()
  })
})

describe("ServerIdentifyOptions with fingerprint", () => {
  it("accepts fingerprint to link device", () => {
    const options: ServerIdentifyOptions = {
      email: "user@example.com",
      fingerprint: "device_abc123",
      userId: "usr_123",
      traits: { name: "John" },
    }
    expectTypeOf(options).toMatchTypeOf<ServerIdentifyOptions>()
  })
})

describe("IdentifyEvent with fingerprint", () => {
  it("includes fingerprint field in type", () => {
    const event: IdentifyEvent = {
      type: "identify",
      timestamp: Date.now(),
      url: "server://user@example.com",
      path: "/",
      email: "user@example.com",
      fingerprint: "device_abc123",
      userId: "usr_123",
    }
    expectTypeOf(event).toMatchTypeOf<IdentifyEvent>()
    expect(event.fingerprint).toBe("device_abc123")
  })
})

describe("IngestPayload with fingerprint", () => {
  it("accepts fingerprint at payload level", () => {
    const payload: IngestPayload = {
      source: "server",
      fingerprint: "device_abc123",
      events: [],
    }
    expectTypeOf(payload).toMatchTypeOf<IngestPayload>()
    expect(payload.fingerprint).toBe("device_abc123")
  })
})

// ============================================
// VALIDATION TESTS
// ============================================

describe("validateServerIdentity with fingerprint", () => {
  it("passes with fingerprint only", () => {
    expect(() => validateServerIdentity("device_abc123", undefined, undefined)).not.toThrow()
  })

  it("passes with fingerprint and email", () => {
    expect(() =>
      validateServerIdentity("device_abc123", "user@example.com", undefined),
    ).not.toThrow()
  })

  it("passes with fingerprint and userId", () => {
    expect(() => validateServerIdentity("device_abc123", undefined, "usr_123")).not.toThrow()
  })

  it("passes with email only (no fingerprint)", () => {
    expect(() => validateServerIdentity(undefined, "user@example.com", undefined)).not.toThrow()
  })

  it("passes with userId only (no fingerprint)", () => {
    expect(() => validateServerIdentity(undefined, undefined, "usr_123")).not.toThrow()
  })

  it("passes with customerId only (no user identity)", () => {
    expect(() => validateServerIdentity(undefined, undefined, undefined, "cust_123")).not.toThrow()
  })

  it("throws with no identifiers", () => {
    expect(() => validateServerIdentity(undefined, undefined, undefined)).toThrow()
  })
})

// ============================================
// PAYLOAD BUILDER TESTS
// ============================================

describe("buildCustomEvent with fingerprint", () => {
  it("assigns a uuidv7 to each built event", () => {
    const firstEvent = buildCustomEvent({
      url: "server://device_abc123",
      eventName: "page_view",
      fingerprint: "device_abc123",
    })
    const secondEvent = buildCustomEvent({
      url: "server://device_abc123",
      eventName: "page_view",
      fingerprint: "device_abc123",
    })

    expect(firstEvent.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(secondEvent.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(firstEvent.uuid).not.toBe(secondEvent.uuid)
  })

  it("includes fingerprint as a top-level event field", () => {
    const event = buildCustomEvent({
      url: "server://device_abc123",
      eventName: "page_view",
      fingerprint: "device_abc123",
      properties: { page: "/pricing" },
    })

    expect(event.type).toBe("custom")
    expect(event.fingerprint).toBe("device_abc123")
    expect(event.properties?.page).toBe("/pricing")
  })
})

describe("buildIdentifyEvent with fingerprint", () => {
  it("includes fingerprint field", () => {
    const event = buildIdentifyEvent({
      url: "server://user@example.com",
      email: "user@example.com",
      fingerprint: "device_abc123",
      userId: "usr_123",
    })

    expect(event.type).toBe("identify")
    expect(event.fingerprint).toBe("device_abc123")
    expect(event.email).toBe("user@example.com")
    expect(event.userId).toBe("usr_123")
  })

  it("omits fingerprint when not provided", () => {
    const event = buildIdentifyEvent({
      url: "server://user@example.com",
      email: "user@example.com",
    })

    expect(event.type).toBe("identify")
    expect(event.fingerprint).toBeUndefined()
  })
})

describe("buildIngestPayload with fingerprint", () => {
  it("includes fingerprint when provided", () => {
    const payload = buildIngestPayload(
      "", // visitorId (empty for server)
      "server",
      [],
      undefined, // userIdentity
      undefined, // sessionId
      "device_abc123", // fingerprint
      undefined, // customerIdentity
    )

    expect(payload.fingerprint).toBe("device_abc123")
  })

  it("omits fingerprint when not provided", () => {
    const payload = buildIngestPayload("", "server", [])

    expect(payload.fingerprint).toBeUndefined()
  })

  it("includes fingerprint alongside other fields", () => {
    const payload = buildIngestPayload(
      "visitor_123",
      "server",
      [],
      { email: "user@example.com" },
      undefined,
      "device_abc123",
      undefined,
    )

    expect(payload.visitorId).toBe("visitor_123")
    expect(payload.fingerprint).toBe("device_abc123")
    expect(payload.userIdentity?.email).toBe("user@example.com")
  })
})
