import { beforeEach, describe, expect, test } from "bun:test"
import { parseActivationDefinition, parseActivationPreviewOptions } from "../../src/lib/activation"
import { runExpectingError, setNonInteractive } from "../helpers"

const SIGNAL_1 = "10000000-0000-4000-8000-000000000001"
const SIGNAL_2 = "10000000-0000-4000-8000-000000000002"
const SIGNAL_3 = "10000000-0000-4000-8000-000000000003"
const SIGNAL_4 = "10000000-0000-4000-8000-000000000004"

describe("activation input parsing", () => {
  beforeEach(() => {
    setNonInteractive()
  })

  test("uses ANY for the ergonomic single-signal form", () => {
    expect(parseActivationDefinition({ signal: ` ${SIGNAL_1} ` }, true)).toEqual({
      signalIds: [SIGNAL_1],
      matchMode: "ANY",
    })
  })

  test("parses and deduplicates comma-separated ALL signals", () => {
    expect(
      parseActivationDefinition(
        {
          signals: `${SIGNAL_1}, ${SIGNAL_2},${SIGNAL_1}`,
          match: "all",
        },
        true,
      ),
    ).toEqual({
      signalIds: [SIGNAL_1, SIGNAL_2],
      matchMode: "ALL",
    })
  })

  test("supports ANY across two signals without threshold or window", () => {
    expect(
      parseActivationDefinition(
        {
          signals: `${SIGNAL_1},${SIGNAL_2}`,
          match: "ANY",
        },
        true,
      ),
    ).toEqual({
      signalIds: [SIGNAL_1, SIGNAL_2],
      matchMode: "ANY",
    })
  })

  test("maps AT_LEAST threshold and compact window to the Core wire shape", () => {
    expect(
      parseActivationDefinition(
        {
          signals: `${SIGNAL_1},${SIGNAL_2},${SIGNAL_3}`,
          match: "AT_LEAST",
          threshold: "2",
          window: "30d",
        },
        true,
      ),
    ).toEqual({
      signalIds: [SIGNAL_1, SIGNAL_2, SIGNAL_3],
      matchMode: "AT_LEAST",
      thresholdCount: 2,
      window: { value: 30, unit: "day" },
    })
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

  test("requires one of --signal or --signals", async () => {
    await runExpectingError(async () => {
      parseActivationDefinition({}, true)
    }, "missing_input")
  })

  for (const [label, signal] of [
    ["non-empty", SIGNAL_1],
    ["whitespace-only", " "],
  ] as const) {
    test(`rejects ${label} --signal together with --signals`, async () => {
      await runExpectingError(async () => {
        parseActivationDefinition(
          { signal, signals: `${SIGNAL_1},${SIGNAL_2}`, match: "ANY" },
          true,
        )
      }, "invalid_input")
    })
  }

  test("requires an explicit match mode for multiple signals", async () => {
    await runExpectingError(async () => {
      parseActivationDefinition({ signals: `${SIGNAL_1},${SIGNAL_2}` }, true)
    }, "missing_input")
  })

  test("rejects more than three signals", async () => {
    await runExpectingError(async () => {
      parseActivationDefinition(
        { signals: `${SIGNAL_1},${SIGNAL_2},${SIGNAL_3},${SIGNAL_4}`, match: "ANY" },
        true,
      )
    }, "invalid_input")
  })

  test("requires single-signal definitions to use ANY without threshold or window", async () => {
    for (const input of [
      { signal: SIGNAL_1, match: "ALL" },
      { signal: SIGNAL_1, threshold: "1" },
      { signal: SIGNAL_1, window: "24h" },
    ]) {
      await runExpectingError(async () => {
        parseActivationDefinition(input, true)
      }, "invalid_input")
    }
  })

  test("requires a threshold from two through the signal count for AT_LEAST", async () => {
    for (const threshold of [undefined, "1", "3"]) {
      await runExpectingError(
        async () => {
          parseActivationDefinition(
            {
              signals: `${SIGNAL_1},${SIGNAL_2}`,
              match: "AT_LEAST",
              threshold,
            },
            true,
          )
        },
        threshold === undefined ? "missing_input" : "invalid_input",
      )
    }
  })

  test("rejects threshold for ANY or ALL", async () => {
    for (const match of ["ANY", "ALL"]) {
      await runExpectingError(async () => {
        parseActivationDefinition(
          { signals: `${SIGNAL_1},${SIGNAL_2}`, match, threshold: "2" },
          true,
        )
      }, "invalid_input")
    }
  })

  test("enforces Core's hour and day window bounds", async () => {
    for (const window of ["0h", "169h", "0d", "91d", "1.5d", "30m"]) {
      await runExpectingError(async () => {
        parseActivationDefinition(
          { signals: `${SIGNAL_1},${SIGNAL_2}`, match: "ALL", window },
          true,
        )
      }, "invalid_input")
    }
  })

  test("enforces Core's preview option bounds", async () => {
    for (const input of [
      { "lookback-days": "0" },
      { "lookback-days": "91" },
      { "example-limit": "0" },
      { "example-limit": "21" },
    ]) {
      await runExpectingError(async () => {
        parseActivationPreviewOptions(input, true)
      }, "invalid_input")
    }
  })

  test("rejects signal identifiers that are not UUIDs", async () => {
    await runExpectingError(async () => {
      parseActivationDefinition({ signal: "signal_1" }, true)
    }, "invalid_input")
  })
})
