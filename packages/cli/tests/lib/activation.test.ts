import { beforeEach, describe, expect, test } from "bun:test"
import {
  type ActivationGetResponse,
  type ActivationPreviewResponse,
  type ActivationUpdateResponse,
  parseActivationEvent,
  parseActivationPreviewOptions,
} from "../../src/lib/activation"
import { runExpectingError, setNonInteractive } from "../helpers"

function exactGetCommandId(value: ActivationGetResponse["commandId"]): "customer_activation.get" {
  return value
}

function exactPreviewOperationId(
  value: ActivationPreviewResponse["result"]["operationId"],
): "customer_activation.preview" {
  return value
}

function exactUpdateVersion(value: ActivationUpdateResponse["commandVersion"]): 1 {
  return value
}

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

  test("types exact activation command IDs and version", () => {
    expect(exactGetCommandId("customer_activation.get")).toBe("customer_activation.get")
    expect(exactPreviewOperationId("customer_activation.preview")).toBe(
      "customer_activation.preview",
    )
    expect(exactUpdateVersion(1)).toBe(1)
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
