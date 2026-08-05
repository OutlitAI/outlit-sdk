import { describe, expect, test } from "vitest"
import { buildIngestUrl, INGEST_EVENT_TYPES, INGEST_METHOD } from "../transport"

describe("Core-owned ingest transport", () => {
  test("builds the generated public-key endpoint", () => {
    expect(buildIngestUrl("https://app.outlit.ai/", "pk_test/unsafe")).toBe(
      "https://app.outlit.ai/api/i/v1/pk_test%2Funsafe/events",
    )
    expect(INGEST_METHOD).toBe("POST")
    expect(INGEST_EVENT_TYPES).toEqual([
      "pageview",
      "form",
      "identify",
      "custom",
      "calendar",
      "engagement",
    ])
  })
})
