import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Outlit } from "../client"

const fetchMock = vi.fn()
const uuidV7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getLastPayload() {
  const call = fetchMock.mock.calls.at(-1)
  if (!call) {
    throw new Error("Expected fetch to be called")
  }

  const [, init] = call
  if (!init || typeof init !== "object" || !("body" in init)) {
    throw new Error("Expected fetch body")
  }

  return JSON.parse(String((init as RequestInit).body))
}

beforeEach(() => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, processed: 1 }),
  })
  globalThis.fetch = fetchMock as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  fetchMock.mockReset()
})

describe("Outlit", () => {
  it("defaults event delivery to the hosted Outlit ingest endpoint", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", flushInterval: 60_000 })

    outlit.track({
      customerId: "cust_123",
      eventName: "account_synced",
    })

    await outlit.flush()

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.outlit.ai/api/i/v1/pk_test/events",
      expect.any(Object),
    )

    await outlit.shutdown()
  })

  it("tracks customer-only events with top-level customer attribution", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", flushInterval: 60_000 })

    outlit.track({
      customerId: "cust_123",
      eventName: "account_synced",
    })

    await outlit.flush()

    const payload = getLastPayload()
    expect(payload.source).toBe("server")
    const event = payload.events[0]!
    expect(event.customerId).toBe("cust_123")
    expect(event).not.toHaveProperty("customerDomain")

    await outlit.shutdown()
  })

  it("sends server custom track events with an event uuid", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", flushInterval: 60_000 })

    outlit.track({
      customerId: "cust_123",
      eventName: "account_synced",
    })

    await outlit.flush()

    const payload = getLastPayload()
    const event = payload.events[0]!
    expect(event.type).toBe("custom")
    expect(event.uuid).toMatch(uuidV7Regex)

    await outlit.shutdown()
  })

  it("identifies a user while preserving customer context", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", flushInterval: 60_000 })

    outlit.identify({
      email: "user@example.com",
      userId: "usr_123",
      customerId: "cust_123",
      customerTraits: {
        plan: "pro",
      },
      traits: {
        name: "Jane Doe",
      },
    })

    await outlit.flush()

    const payload = getLastPayload()
    const event = payload.events[0]!
    expect(event.type).toBe("identify")
    expect(event.customerId).toBe("cust_123")
    expect(event).not.toHaveProperty("customerDomain")
    expect(event.customerTraits?.plan).toBe("pro")

    await outlit.shutdown()
  })

  it("preserves stage identity markers for server batches", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", flushInterval: 60_000 })

    outlit.user.activate({
      email: "user@example.com",
      userId: "usr_123",
      properties: { source: "signup" },
    })

    await outlit.flush()

    const payload = getLastPayload()
    const event = payload.events[0]!
    expect(event.type).toBe("stage")
    expect(event.eventName).toBe("activated")
    expect(event.properties?.__email).toBe("user@example.com")
    expect(event.properties?.__userId).toBe("usr_123")
    expect(event.properties?.__fingerprint).toBeNull()
    expect(event.properties?.source).toBe("signup")

    await outlit.shutdown()
  })

  it("publishes billing events using customerId", async () => {
    const outlit = new Outlit({ publicKey: "pk_test", flushInterval: 60_000 })

    outlit.customer.paid({
      customerId: "cust_123",
      properties: { plan: "enterprise" },
    })

    await outlit.flush()

    const payload = getLastPayload()
    const event = payload.events[0]!
    expect(event.type).toBe("billing")
    expect(event.customerId).toBe("cust_123")
    expect(event).not.toHaveProperty("customerDomain")

    await outlit.shutdown()
  })
})
