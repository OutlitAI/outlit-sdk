import { beforeEach, describe, expect, test } from "bun:test"
import { parseActivationEvent, parseActivationPreviewOptions } from "../../src/lib/activation"
import { runExpectingError, setNonInteractive } from "../helpers"

describe("activation input parsing", () => {
  beforeEach(() => {
    setNonInteractive()
  })

  test("trims and returns one exact event name", () => {
    expect(parseActivationEvent({ event: " integration_connected " }, true)).toBe(
      "integration_connected",
    )
  })

  test("accepts the maximum 191-character event name", () => {
    const eventName = "e".repeat(191)

    expect(parseActivationEvent({ event: eventName }, true)).toBe(eventName)
  })

  test("requires a non-empty event name", async () => {
    for (const event of [undefined, "", "   "]) {
      await runExpectingError(async () => {
        parseActivationEvent({ event }, true)
      }, "missing_input")
    }
  })

  test("rejects event names longer than 191 characters", async () => {
    await runExpectingError(async () => {
      parseActivationEvent({ event: "e".repeat(192) }, true)
    }, "invalid_input")
  })

  test("parses preview bounds without injecting Core defaults", () => {
    expect(
      parseActivationPreviewOptions({ "lookback-days": "45", "example-limit": "12" }, true),
    ).toEqual({
      lookbackDays: 45,
      exampleLimit: 12,
    })
    expect(parseActivationPreviewOptions({}, true)).toEqual({})
  })

  test("enforces Core's preview option bounds", async () => {
    for (const input of [
      { "lookback-days": "0" },
      { "lookback-days": "91" },
      { "lookback-days": "1.5" },
      { "example-limit": "0" },
      { "example-limit": "21" },
      { "example-limit": "1.5" },
    ]) {
      await runExpectingError(async () => {
        parseActivationPreviewOptions(input, true)
      }, "invalid_input")
    }
  })
})
