import { beforeEach, describe, expect, mock, test } from "bun:test"
import { runCommand } from "citty"
import {
  captureStdout,
  runExpectingError,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const SIGNAL_1 = "10000000-0000-4000-8000-000000000001"
const SIGNAL_2 = "10000000-0000-4000-8000-000000000002"

const getResponse = {
  ok: true,
  commandId: "customer_activation.get",
  commandVersion: 1,
  correlationId: "corr_get",
  result: {
    operationId: "customer_activation.get",
    status: "completed",
    resources: [],
    data: {
      activation: {
        definition: null,
        compatibility: {
          legacyContactActivationEvent: "onboarding_completed",
          legacyBehavior: "contact_only",
          migration: "explicit_signal_definition_required",
        },
      },
    },
    warnings: [],
  },
}

const previewResponse = {
  ok: true,
  commandId: "customer_activation.preview",
  commandVersion: 1,
  correlationId: "corr_preview",
  result: {
    operationId: "customer_activation.preview",
    status: "completed",
    resources: [],
    data: {
      preview: {
        evaluatedFrom: "2026-06-28T00:00:00.000Z",
        evaluatedTo: "2026-07-28T00:00:00.000Z",
        evaluatedOccurrenceCount: 40,
        matchedCustomerCount: 12,
        alreadyActivatedCustomerCount: 9,
        wouldActivateCustomerCount: 3,
        truncated: false,
        examples: [],
      },
    },
    warnings: [],
  },
}

const mockCallTool = mock(async (toolName: string, _params: unknown) => {
  if (toolName === "outlit_activation_preview") return previewResponse
  return getResponse
})

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("activation commands", () => {
  useTempEnv("activation-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
    mockCallTool.mockImplementation(async (toolName: string) => {
      if (toolName === "outlit_activation_preview") return previewResponse
      return getResponse
    })
  })

  test("get preserves Core's stable command envelope", async () => {
    const { default: getCommand } = await import("../../src/commands/activation/get")

    const result = await captureStdout(async () => {
      await getCommand.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof getCommand.run>>[0])
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_activation_get", {})
    expect(result).toEqual(getResponse)
  })

  test("interactive output preserves the same stable command envelope", async () => {
    const { default: getCommand } = await import("../../src/commands/activation/get")
    setInteractive()

    try {
      const result = await captureStdout(async () => {
        await getCommand.run!({
          args: {},
        } as Parameters<NonNullable<typeof getCommand.run>>[0])
      })

      expect(result).toEqual(getResponse)
    } finally {
      setNonInteractive()
    }
  })

  test("preview uses the separately typed read-only operation", async () => {
    const { default: previewCommand } = await import("../../src/commands/activation/preview")

    const result = await captureStdout(async () => {
      await previewCommand.run!({
        args: {
          signals: `${SIGNAL_1},${SIGNAL_2}`,
          match: "ALL",
          window: "30d",
          "lookback-days": "45",
          "example-limit": "12",
          json: true,
        },
      } as Parameters<NonNullable<typeof previewCommand.run>>[0])
    })

    expect(mockCallTool).toHaveBeenCalledTimes(1)
    expect(mockCallTool).toHaveBeenCalledWith("outlit_activation_preview", {
      definition: {
        signalIds: [SIGNAL_1, SIGNAL_2],
        matchMode: "ALL",
        window: { value: 30, unit: "day" },
      },
      lookbackDays: 45,
      exampleLimit: 12,
    })
    expect(mockCallTool).not.toHaveBeenCalledWith("outlit_activation_set", expect.anything())
    expect(result).toEqual(previewResponse)
  })

  test("citty parses preview flags into Core's typed request", async () => {
    const { default: previewCommand } = await import("../../src/commands/activation/preview")

    await captureStdout(async () => {
      await runCommand(previewCommand, {
        rawArgs: [
          "--signals",
          `${SIGNAL_1},${SIGNAL_2}`,
          "--match",
          "AT_LEAST",
          "--threshold",
          "2",
          "--window",
          "168h",
          "--lookback-days",
          "90",
          "--example-limit",
          "20",
          "--json",
        ],
      })
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_activation_preview", {
      definition: {
        signalIds: [SIGNAL_1, SIGNAL_2],
        matchMode: "AT_LEAST",
        thresholdCount: 2,
        window: { value: 168, unit: "hour" },
      },
      lookbackDays: 90,
      exampleLimit: 20,
    })
  })

  test("set explicitly wraps a complete single-signal definition", async () => {
    const { default: setCommand } = await import("../../src/commands/activation/set")

    await captureStdout(async () => {
      await setCommand.run!({
        args: {
          signal: SIGNAL_1,
          json: true,
        },
      } as Parameters<NonNullable<typeof setCommand.run>>[0])
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_activation_set", {
      definition: {
        signalIds: [SIGNAL_1],
        matchMode: "ANY",
      },
    })
  })

  test("set --disable explicitly sends a null definition", async () => {
    const { default: setCommand } = await import("../../src/commands/activation/set")

    await captureStdout(async () => {
      await setCommand.run!({
        args: {
          disable: true,
          json: true,
        },
      } as Parameters<NonNullable<typeof setCommand.run>>[0])
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_activation_set", {
      definition: null,
    })
  })

  for (const [flag, definitionArgs] of [
    ["signal", { signal: SIGNAL_1 }],
    ["signals", { signals: `${SIGNAL_1},${SIGNAL_2}` }],
    ["match", { match: "ANY" }],
    ["threshold", { threshold: "2" }],
    ["window", { window: "24h" }],
  ] as const) {
    test(`--disable rejects --${flag} before mutation`, async () => {
      const { default: setCommand } = await import("../../src/commands/activation/set")

      await runExpectingError(async () => {
        await setCommand.run!({
          args: {
            disable: true,
            ...definitionArgs,
            json: true,
          },
        } as Parameters<NonNullable<typeof setCommand.run>>[0])
      }, "invalid_input")

      expect(mockCallTool).not.toHaveBeenCalled()
    })
  }

  test("invalid set input exits before any API mutation", async () => {
    const { default: setCommand } = await import("../../src/commands/activation/set")

    await runExpectingError(async () => {
      await setCommand.run!({
        args: {
          signals: `${SIGNAL_1},${SIGNAL_2}`,
          match: "AT_LEAST",
          threshold: "3",
          json: true,
        },
      } as Parameters<NonNullable<typeof setCommand.run>>[0])
    }, "invalid_input")

    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("API failures retain the existing api_error envelope and exit code", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (503): unavailable")
    })
    const { default: getCommand } = await import("../../src/commands/activation/get")

    await runExpectingError(async () => {
      await getCommand.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof getCommand.run>>[0])
    }, "api_error")
  })

  test("set help distinguishes company activation from contact journeys", async () => {
    const { default: setCommand } = await import("../../src/commands/activation/set")
    const metaSource = setCommand.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)
    const description = meta?.description ?? ""

    expect(description).toContain("company")
    expect(description).toContain("Core")
    expect(description).toContain("monotonic")
    expect(description).toContain("contact")
  })
})
