import { describe, expect, test } from "bun:test"
import { isVerbose, responseMetaLines } from "../../src/lib/notices"

const info = {
  tool: "outlit_list_customers" as const,
  status: 200,
  notices: [],
  replayed: false,
  requestId: "req_1",
  version: "2026-11-12",
}

describe("--verbose", () => {
  test("is on only when the command line says so", () => {
    expect(isVerbose(["customers", "list", "--verbose"])).toBe(true)
    expect(isVerbose(["customers", "list"])).toBe(false)
  })

  test("prints the request id and API version as two lines, or one JSON line in JSON mode", () => {
    expect(responseMetaLines(info, false)).toEqual(["Request ID: req_1", "API version: 2026-11-12"])
    expect(JSON.parse(responseMetaLines(info, true)[0] ?? "")).toEqual({
      requestId: "req_1",
      version: "2026-11-12",
    })
    expect(responseMetaLines({ ...info, requestId: undefined, version: undefined }, false)).toEqual(
      [],
    )
  })
})
