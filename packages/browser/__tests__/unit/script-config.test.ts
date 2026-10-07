import { describe, expect, it } from "vitest"
import { parseDataAutoTrack } from "../../src/script-config"

describe("parseDataAutoTrack", () => {
  it("returns undefined when the attribute is absent", () => {
    expect(parseDataAutoTrack(null)).toBeUndefined()
  })

  it('parses "true" as true', () => {
    expect(parseDataAutoTrack("true")).toBe(true)
  })

  it('parses "false" as false', () => {
    expect(parseDataAutoTrack("false")).toBe(false)
  })

  it('parses "auto" as "auto"', () => {
    expect(parseDataAutoTrack("auto")).toBe("auto")
  })

  it("falls back to the SDK default for unrecognized values", () => {
    expect(parseDataAutoTrack("yes")).toBeUndefined()
    expect(parseDataAutoTrack("")).toBeUndefined()
  })
})
