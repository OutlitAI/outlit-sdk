import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { OutlitToolsApiError, type ToolGatewayErrorEnvelope } from "@outlit/tools"
import { runCommand } from "citty"
import {
  captureStdout,
  ExitError,
  mockExitThrow,
  runExpectingError,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

type ToolInput = Record<string, unknown>

const mockOpenBrowser = mock((_url: string) => true)
const mockWaitForIntegrationConnection = mock(async () => {})
const mockPassword = mock(async () => "synthetic-secret")
const mockText = mock(async () => "visible-value")
const mockSelect = mock(async () => "us")
const mockConfirm = mock(async () => true)
const mockSpinnerUpdate = mock((_message: string) => {})
const mockSpinnerStop = mock((_message: string) => {})
const mockSpinnerFail = mock((_message: string) => {})
const promptCancelled = Symbol("prompt-cancelled")

class MockIntegrationAuthTimeoutError extends Error {}

class MockIntegrationAuthError extends Error {
  constructor(readonly status: "expired" | "failed") {
    super(`Integration authentication ${status}.`)
  }
}

mock.module("../../../src/lib/tty", () => ({
  isUnicodeSupported: true,
  isInteractive: () => Boolean(process.stdin.isTTY && process.stdout.isTTY),
  // mock.module() registrations are visible process-wide when bun runs sibling
  // test files in one invocation, so CI detection must stay env-faithful —
  // a hardcoded false here redirects other suites into the browser-auth flow.
  isCiEnvironment: () =>
    process.env.CI === "true" || process.env.CI === "1" || Boolean(process.env.GITHUB_ACTIONS),
  openBrowser: mockOpenBrowser,
  promptInput: async () => "",
}))

mock.module("../../../src/commands/integrations/wait-for-connection", () => ({
  waitForIntegrationConnection: mockWaitForIntegrationConnection,
  IntegrationAuthError: MockIntegrationAuthError,
  IntegrationAuthTimeoutError: MockIntegrationAuthTimeoutError,
}))

mock.module("../../../src/lib/spinner", () => ({
  createSpinner: () => ({
    update: mockSpinnerUpdate,
    stop: mockSpinnerStop,
    fail: mockSpinnerFail,
  }),
}))

mock.module("@clack/prompts", () => ({
  password: mockPassword,
  text: mockText,
  select: mockSelect,
  confirm: mockConfirm,
  isCancel: (value: unknown) => value === promptCancelled,
  log: { info: () => {}, warn: () => {} },
}))

function setupResult(
  overrides: Partial<{
    provider: string
    name: string
    category: string
    status: string
    step: unknown
    problem: unknown
  }> = {},
) {
  return {
    provider: "hubspot",
    name: "HubSpot",
    category: "crm",
    status: "ready",
    step: null,
    problem: null,
    ...overrides,
  }
}

function gatewayError(
  envelope: ToolGatewayErrorEnvelope,
  status = envelope.retryable ? 503 : 400,
): OutlitToolsApiError {
  return new OutlitToolsApiError(status, JSON.stringify(envelope), envelope)
}

async function captureJsonError(fn: () => Promise<void>): Promise<Record<string, unknown>> {
  const exitSpy = mockExitThrow()
  const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

  let thrown: unknown
  let stderrWritten = ""
  try {
    await fn()
  } catch (error) {
    thrown = error
    stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
  } finally {
    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  }

  expect(thrown).toBeInstanceOf(ExitError)
  expect((thrown as ExitError).code).toBe(1)
  return JSON.parse(stderrWritten) as Record<string, unknown>
}

const mockCallTool = mock(async (toolName: string, input: ToolInput): Promise<unknown> => {
  if (toolName === "outlit_setup_integration")
    return setupResult({ provider: String(input.provider) })
  throw new Error(`unexpected tool ${toolName}`)
})

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
  validateApiBaseUrl: () => {},
}))

describe("integrations setup", () => {
  useTempEnv("integrations-setup-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
    mockOpenBrowser.mockClear()
    mockWaitForIntegrationConnection.mockClear()
    mockPassword.mockClear()
    mockText.mockClear()
    mockSelect.mockClear()
    mockConfirm.mockClear()
    mockSpinnerUpdate.mockClear()
    mockSpinnerStop.mockClear()
    mockSpinnerFail.mockClear()
    mockSpinnerFail.mockImplementation(() => {})
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_setup_integration") {
        return setupResult({ provider: String(input.provider) })
      }
      throw new Error(`unexpected tool ${toolName}`)
    })
  })

  test("makes a secretless setup call with its own retry key", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const result = await captureStdout(() =>
      setup.run!({ args: { provider: "hubspot", json: true } } as never),
    )

    expect(mockCallTool).toHaveBeenCalledTimes(1)
    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_setup_integration", {
      provider: "hubspot",
      requestId: expect.any(String),
    })
    expect(result).toEqual(setupResult())
  })

  test("rejects an unknown provider before any network call", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await runExpectingError(
      () => setup.run!({ args: { provider: "not-a-provider", json: true } } as never),
      "unknown_provider",
    )

    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("preserves a validation envelope from preferred setup", async () => {
    const envelope = {
      code: "INVALID_TOOL_INPUT" as const,
      message: "Integration setup input is invalid.",
      retryable: false,
      requestId: "request_setup_invalid",
    }
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName === "outlit_setup_integration") throw gatewayError(envelope, 400)
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const error = await captureJsonError(() =>
      setup.run!({ args: { provider: "hubspot", json: true } } as never),
    )

    expect(error).toEqual(envelope)
  })

  test("preserves retryability and request ID from a preferred setup failure", async () => {
    const envelope = {
      code: "TOOL_IMPLEMENTATION_ERROR" as const,
      message: "Integration setup is temporarily unavailable.",
      retryable: true,
      requestId: "request_setup_retryable",
    }
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName === "outlit_setup_integration") throw gatewayError(envelope)
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const error = await captureJsonError(() =>
      setup.run!({ args: { provider: "hubspot", json: true } } as never),
    )

    expect(error).toEqual(envelope)
  })

  test("returns an OAuth handoff unchanged in JSON without opening or polling", async () => {
    const handoff = setupResult({
      provider: "stripe",
      name: "Stripe",
      category: "billing",
      status: "awaiting_auth",
      step: {
        kind: "browser_handoff",
        purpose: "authentication",
        url: "https://app.outlit.ai/integrations/connect",
        sessionId: "00000000-0000-4000-8000-000000000001",
        expiresAt: "2026-08-04T22:00:00.000Z",
      },
    })
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName === "outlit_setup_integration") return handoff
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const result = await captureStdout(() =>
      setup.run!({ args: { provider: "stripe", json: true } } as never),
    )

    expect(result).toEqual(handoff)
    expect(mockOpenBrowser).not.toHaveBeenCalled()
    expect(mockWaitForIntegrationConnection).not.toHaveBeenCalled()
  })

  test("never prompts when JSON setup requires credentials", async () => {
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName === "outlit_setup_integration") {
        return setupResult({
          provider: "fireflies",
          name: "Fireflies",
          category: "calls",
          status: "not_connected",
          problem: {
            code: "credential_required",
            message: "Provider credentials are required to continue setup.",
            retryable: false,
          },
        })
      }
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await runExpectingError(
      () => setup.run!({ args: { provider: "fireflies", json: true } } as never),
      "credential_required",
    )

    expect(mockPassword).not.toHaveBeenCalled()
  })

  test("sends an exact confirmed Mixpanel mapping supplied through stdin", async () => {
    const config = {
      credentials: {
        username: "service-user",
        secret: "synthetic-mixpanel-secret",
        projectId: "123",
        region: "us",
      },
      configuration: {
        kind: "mixpanel_mapping",
        mapping: { mode: "group_key", groupKey: "company_id" },
        confirm: true,
      },
    }
    const stdinSpy = spyOn(Bun.stdin, "text").mockResolvedValue(JSON.stringify(config))
    try {
      const { default: setup } = await import("../../../src/commands/integrations/setup")
      await captureStdout(() =>
        setup.run!({
          args: { provider: "mixpanel", json: true, "config-stdin": true },
        } as never),
      )
    } finally {
      stdinSpy.mockRestore()
    }

    expect(mockCallTool).toHaveBeenNthCalledWith(
      1,
      "outlit_setup_integration",
      expect.objectContaining({
        provider: "mixpanel",
        ...config,
      }),
    )
    expect(mockPassword).not.toHaveBeenCalled()
  })

  test("submits the exact displayed CRM recommendation when explicitly accepted", async () => {
    const recommendation = [
      {
        pipelineId: "default",
        pipelineName: "Sales",
        mappings: [{ outlitStage: "won", crmStages: [{ id: "closedwon", name: "Closed Won" }] }],
      },
    ]
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_setup_integration" && !input.configuration) {
        return setupResult({
          status: "setup_required",
          step: { kind: "crm_mapping", recommendation },
        })
      }
      if (toolName === "outlit_setup_integration") return setupResult()
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const result = await captureStdout(() =>
      setup.run!({
        args: { provider: "hubspot", json: true, "accept-recommended": true },
      } as never),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(
      2,
      "outlit_setup_integration",
      expect.objectContaining({
        provider: "hubspot",
        configuration: { kind: "crm_mapping", mappings: recommendation, confirm: true },
      }),
    )
    expect(result).toEqual(setupResult())
  })

  test("accepts the CRM recommendation without prompting when the interactive flag is set", async () => {
    setInteractive()
    const recommendation = [
      {
        pipelineId: "default",
        pipelineName: "Sales",
        mappings: [{ outlitStage: "won", crmStages: [] }],
      },
    ]
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_setup_integration" && !input.configuration) {
        return setupResult({
          status: "setup_required",
          step: { kind: "crm_mapping", recommendation },
        })
      }
      if (toolName === "outlit_setup_integration") return setupResult()
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await setup.run!({
      args: { provider: "hubspot", "accept-recommended": true },
    } as never)

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockCallTool).toHaveBeenNthCalledWith(
      2,
      "outlit_setup_integration",
      expect.objectContaining({
        provider: "hubspot",
        configuration: { kind: "crm_mapping", mappings: recommendation, confirm: true },
      }),
    )
  })

  test("bounds an interactive OAuth to post-auth CRM flow at three setup calls", async () => {
    setInteractive()
    const recommendation = [
      {
        pipelineId: "default",
        pipelineName: "Sales",
        mappings: [{ outlitStage: "created", crmStages: [] }],
      },
    ]
    let setupCalls = 0
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName !== "outlit_setup_integration") throw new Error(`unexpected tool ${toolName}`)
      setupCalls += 1
      if (setupCalls === 1) {
        return setupResult({
          status: "awaiting_auth",
          step: {
            kind: "browser_handoff",
            purpose: "authentication",
            url: "https://app.outlit.ai/integrations/connect",
            sessionId: "00000000-0000-4000-8000-000000000001",
            expiresAt: "2026-08-04T22:00:00.000Z",
          },
        })
      }
      if (setupCalls === 2) {
        return setupResult({
          status: "setup_required",
          step: { kind: "crm_mapping", recommendation },
        })
      }
      return setupResult()
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await setup.run!({ args: { provider: "hubspot" } } as never)

    expect(mockOpenBrowser).toHaveBeenCalledTimes(1)
    expect(mockWaitForIntegrationConnection).toHaveBeenCalledTimes(1)
    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(setupCalls).toBe(3)
    // Each call is its own action with its own retry key; a shared key would replay the first answer.
    const requestIds = mockCallTool.mock.calls.map(
      (call) => (call[1] as { requestId?: string }).requestId,
    )
    expect(requestIds).toHaveLength(3)
    expect(new Set(requestIds).size).toBe(3)
  })

  test("preserves a supplied CRM mapping through an OAuth continuation", async () => {
    setInteractive()
    const configuration = {
      kind: "crm_mapping",
      mappings: [
        {
          pipelineId: "default",
          pipelineName: "Sales",
          mappings: [
            {
              outlitStage: "won",
              crmStages: [{ id: "closedwon", name: "Closed Won" }],
            },
          ],
        },
      ],
      confirm: true,
    }
    let setupCalls = 0
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName !== "outlit_setup_integration") throw new Error(`unexpected tool ${toolName}`)
      setupCalls += 1
      if (setupCalls === 1) {
        return setupResult({
          status: "awaiting_auth",
          step: {
            kind: "browser_handoff",
            purpose: "authentication",
            url: "https://app.outlit.ai/integrations/connect",
            sessionId: "00000000-0000-4000-8000-000000000001",
            expiresAt: "2026-08-04T22:00:00.000Z",
          },
        })
      }
      return setupResult()
    })

    const stdinSpy = spyOn(Bun.stdin, "text").mockResolvedValue(JSON.stringify({ configuration }))
    try {
      const { default: setup } = await import("../../../src/commands/integrations/setup")
      await setup.run!({
        args: { provider: "hubspot", "config-stdin": true },
      } as never)
    } finally {
      stdinSpy.mockRestore()
    }

    expect(mockCallTool).toHaveBeenNthCalledWith(
      2,
      "outlit_setup_integration",
      expect.objectContaining({
        provider: "hubspot",
        configuration,
      }),
    )
  })

  test("treats external setup handoff as terminal and never polls", async () => {
    const handoff = setupResult({
      provider: "pylon",
      name: "Pylon",
      category: "support",
      status: "setup_required",
      step: {
        kind: "browser_handoff",
        purpose: "external_setup",
        url: "https://app.outlit.ai/integrations/pylon",
        sessionId: null,
        expiresAt: null,
      },
    })
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName === "outlit_setup_integration") return handoff
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const result = await captureStdout(() =>
      setup.run!({ args: { provider: "pylon", json: true } } as never),
    )

    expect(result).toEqual(handoff)
    expect(mockWaitForIntegrationConnection).not.toHaveBeenCalled()
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("stalls instead of prompting twice for credentials", async () => {
    setInteractive()
    const credentialRequired = setupResult({
      provider: "fireflies",
      name: "Fireflies",
      category: "calls",
      status: "not_connected",
      problem: {
        code: "credential_required",
        message: "Provider credentials are required to continue setup.",
        retryable: false,
      },
    })
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName === "outlit_setup_integration") return credentialRequired
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await expectInteractiveError(
      () => setup.run!({ args: { provider: "fireflies" } } as never),
      "Integration setup did not reach a terminal state.",
    )

    expect(mockPassword).toHaveBeenCalledTimes(1)
    expect(mockCallTool).toHaveBeenCalledTimes(2)
  })

  test.each([
    ["autumn", "Autumn secret key", { apiKey: "synthetic-secret" }],
    ["ergo", "Ergo API key", { apiKey: "synthetic-secret" }],
  ] as const)("collects the %s credential through the secret prompt", async (provider, prompt, credentials) => {
    const { collectProviderCredentials } = await import(
      "../../../src/commands/integrations/setup-input"
    )

    await expect(collectProviderCredentials(provider)).resolves.toEqual({
      provider,
      credentials,
    })
    expect(mockPassword).toHaveBeenCalledWith(expect.objectContaining({ message: prompt }))
  })

  test.each([
    "autumn",
    "ergo",
  ] as const)("cancels %s setup without producing credentials when its secret prompt is cancelled", async (provider) => {
    mockPassword.mockResolvedValueOnce(promptCancelled as never)
    const { collectProviderCredentials, SetupCancelledError } = await import(
      "../../../src/commands/integrations/setup-input"
    )

    await expect(collectProviderCredentials(provider)).rejects.toBeInstanceOf(SetupCancelledError)
  })

  test("exits nonzero when a credential prompt is cancelled", async () => {
    setInteractive()
    mockPassword.mockResolvedValueOnce(promptCancelled as never)
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName === "outlit_setup_integration") {
        return setupResult({
          provider: "fireflies",
          name: "Fireflies",
          category: "calls",
          status: "not_connected",
          problem: {
            code: "credential_required",
            message: "Provider credentials are required to continue setup.",
            retryable: false,
          },
        })
      }
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await expectInteractiveError(
      () => setup.run!({ args: { provider: "fireflies" } } as never),
      "Integration setup was cancelled.",
    )

    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("exits nonzero when CRM mapping confirmation is cancelled", async () => {
    setInteractive()
    mockConfirm.mockResolvedValueOnce(promptCancelled as never)
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName === "outlit_setup_integration") {
        return setupResult({
          status: "setup_required",
          step: {
            kind: "crm_mapping",
            recommendation: [
              {
                pipelineId: "default",
                pipelineName: "Sales",
                mappings: [{ outlitStage: "won", crmStages: [] }],
              },
            ],
          },
        })
      }
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await expectInteractiveError(
      () => setup.run!({ args: { provider: "hubspot" } } as never),
      "Integration setup was cancelled.",
    )

    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("stalls when Mixpanel requests a second mapping transition", async () => {
    setInteractive()
    mockSelect.mockResolvedValueOnce("group_key").mockResolvedValueOnce("company_id")
    const mappingRequired = setupResult({
      provider: "mixpanel",
      name: "Mixpanel",
      category: "analytics",
      status: "setup_required",
      step: {
        kind: "mixpanel_mapping",
        preview: {
          sampleSize: 1,
          sampleWindowStartAt: "2026-08-01T00:00:00.000Z",
          sampleWindowEndAt: "2026-08-02T00:00:00.000Z",
          accountKeyCoveragePct: 100,
          emailOrDomainCoveragePct: 100,
          unmappedPct: 0,
          matchedCustomerCount: 1,
          opaqueOnlyUnmappedCount: 0,
          candidateAccountKeys: [{ key: "company_id", count: 1, coveragePct: 100 }],
          unmappedReasons: [],
          warnings: [],
        },
      },
    })
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName === "outlit_setup_integration") return mappingRequired
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await expectInteractiveError(
      () => setup.run!({ args: { provider: "mixpanel" } } as never),
      "Integration setup did not reach a terminal state.",
    )

    expect(mockCallTool).toHaveBeenCalledTimes(2)
  })

  test("displays the returned Mixpanel preview before asking for a mapping", async () => {
    setInteractive()
    const preview = {
      sampleSize: 1,
      sampleWindowStartAt: "2026-08-01T00:00:00.000Z",
      sampleWindowEndAt: "2026-08-02T00:00:00.000Z",
      accountKeyCoveragePct: 100,
      emailOrDomainCoveragePct: 100,
      unmappedPct: 0,
      matchedCustomerCount: 1,
      opaqueOnlyUnmappedCount: 0,
      candidateAccountKeys: [{ key: "company_id", count: 1, coveragePct: 100 }],
      unmappedReasons: [],
      warnings: ["Synthetic preview warning"],
    }
    let setupCalls = 0
    mockCallTool.mockImplementation(async (toolName: string, _input: ToolInput) => {
      if (toolName !== "outlit_setup_integration") throw new Error(`unexpected tool ${toolName}`)
      setupCalls += 1
      if (setupCalls === 1) {
        return setupResult({
          provider: "mixpanel",
          name: "Mixpanel",
          category: "analytics",
          status: "setup_required",
          step: { kind: "mixpanel_mapping", preview },
        })
      }
      return setupResult({
        provider: "mixpanel",
        name: "Mixpanel",
        category: "analytics",
      })
    })

    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    let previewSeenBeforeChoice = false
    mockSelect.mockImplementationOnce(async () => {
      const output = logSpy.mock.calls.map((call) => call[0]).join("\n")
      previewSeenBeforeChoice =
        output.includes("Mixpanel mapping preview") && output.includes("Synthetic preview warning")
      return "group_key"
    })
    mockSelect.mockResolvedValueOnce("company_id")

    try {
      const { default: setup } = await import("../../../src/commands/integrations/setup")
      await setup.run!({ args: { provider: "mixpanel" } } as never)
    } finally {
      logSpy.mockRestore()
    }

    expect(setupCalls).toBe(2)
    expect(previewSeenBeforeChoice).toBe(true)
  })

  describe("Stripe renewal date field", () => {
    const renewalStep = setupResult({
      provider: "stripe",
      name: "Stripe",
      category: "billing",
      status: "ready",
      step: {
        kind: "stripe_renewal_date_field",
        selectedKey: null,
        liveSubscriptionCount: 5,
        keys: [
          { key: "renews_at", subscriptionCount: 2, sampleDate: "2028-01-31" },
          { key: "plan_notes", subscriptionCount: 4, sampleDate: null },
        ],
      },
    })

    function mockStripeSetup(onSetup: (input: ToolInput, call: number) => unknown) {
      let setupCalls = 0
      mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
        if (toolName !== "outlit_setup_integration") throw new Error(`unexpected tool ${toolName}`)
        setupCalls += 1
        return onSetup(input, setupCalls)
      })
    }

    test("lists the keys, offers only date keys, and sends the picked key", async () => {
      setInteractive()
      mockStripeSetup((_input, call) =>
        call === 1 ? renewalStep : setupResult({ provider: "stripe", name: "Stripe" }),
      )
      const logSpy = spyOn(console, "log").mockImplementation(() => {})
      let output = ""
      let offered: unknown
      mockSelect.mockImplementationOnce((async (options: { options: unknown }) => {
        offered = options.options
        return "renews_at"
      }) as never)

      try {
        const { default: setup } = await import("../../../src/commands/integrations/setup")
        await setup.run!({ args: { provider: "stripe" } } as never)
      } finally {
        output = logSpy.mock.calls.map((call) => call[0]).join("\n")
        logSpy.mockRestore()
      }

      expect(output).toContain("renews_at · on 2 of 5 subscriptions · e.g. Jan 31, 2028")
      expect(output).toContain("plan_notes · on 4 of 5 subscriptions · not a date")
      expect(offered).toEqual([
        { value: "renews_at", label: "renews_at" },
        { value: "", label: "Skip" },
      ])
      expect(mockCallTool).toHaveBeenCalledTimes(2)
      expect(mockCallTool).toHaveBeenNthCalledWith(
        2,
        "outlit_setup_integration",
        expect.objectContaining({
          provider: "stripe",
          configuration: { kind: "stripe_renewal_date_field", key: "renews_at" },
        }),
      )
      expect(output).toContain("Stripe: ready")
    })

    test("finishes ready without saving when the person skips", async () => {
      setInteractive()
      mockStripeSetup(() => renewalStep)
      mockSelect.mockResolvedValueOnce("" as never)
      const logSpy = spyOn(console, "log").mockImplementation(() => {})
      let printed: unknown[] = []

      try {
        const { default: setup } = await import("../../../src/commands/integrations/setup")
        await setup.run!({ args: { provider: "stripe" } } as never)
      } finally {
        printed = logSpy.mock.calls.map((call) => call[0])
        logSpy.mockRestore()
      }

      expect(mockCallTool).toHaveBeenCalledTimes(1)
      expect(printed).toContain("Stripe: ready")
    })

    test("skips the prompt when no key holds a date", async () => {
      setInteractive()
      mockStripeSetup(() =>
        setupResult({
          provider: "stripe",
          name: "Stripe",
          step: {
            kind: "stripe_renewal_date_field",
            selectedKey: null,
            liveSubscriptionCount: 1,
            keys: [{ key: "plan_notes", subscriptionCount: 1, sampleDate: null }],
          },
        }),
      )
      const logSpy = spyOn(console, "log").mockImplementation(() => {})

      try {
        const { default: setup } = await import("../../../src/commands/integrations/setup")
        await setup.run!({ args: { provider: "stripe" } } as never)
      } finally {
        logSpy.mockRestore()
      }

      expect(mockSelect).not.toHaveBeenCalled()
      expect(mockCallTool).toHaveBeenCalledTimes(1)
    })

    test("returns the step unchanged in JSON mode without prompting", async () => {
      mockStripeSetup(() => renewalStep)

      const { default: setup } = await import("../../../src/commands/integrations/setup")
      const result = await captureStdout(() =>
        setup.run!({ args: { provider: "stripe", json: true } } as never),
      )

      expect(result).toEqual(renewalStep)
      expect(mockSelect).not.toHaveBeenCalled()
      expect(mockCallTool).toHaveBeenCalledTimes(1)
    })

    test("sends a supplied key through stdin and returns the response", async () => {
      const config = { configuration: { kind: "stripe_renewal_date_field", key: null } }
      mockStripeSetup(() => setupResult({ provider: "stripe", name: "Stripe" }))
      const stdinSpy = spyOn(Bun.stdin, "text").mockResolvedValue(JSON.stringify(config))
      try {
        const { default: setup } = await import("../../../src/commands/integrations/setup")
        await captureStdout(() =>
          setup.run!({
            args: { provider: "stripe", json: true, "config-stdin": true },
          } as never),
        )
      } finally {
        stdinSpy.mockRestore()
      }

      expect(mockCallTool).toHaveBeenNthCalledWith(
        1,
        "outlit_setup_integration",
        expect.objectContaining({
          provider: "stripe",
          ...config,
        }),
      )
    })

    test("exits nonzero when the key prompt is cancelled", async () => {
      setInteractive()
      mockStripeSetup(() => renewalStep)
      mockSelect.mockResolvedValueOnce(promptCancelled as never)

      const { default: setup } = await import("../../../src/commands/integrations/setup")
      await expectInteractiveError(
        () => setup.run!({ args: { provider: "stripe" } } as never),
        "Integration setup was cancelled.",
      )
    })

    test("stalls when Core repeats the step after a pick", async () => {
      setInteractive()
      mockStripeSetup(() => renewalStep)
      mockSelect.mockResolvedValueOnce("renews_at" as never)

      const { default: setup } = await import("../../../src/commands/integrations/setup")
      await expectInteractiveError(
        () => setup.run!({ args: { provider: "stripe" } } as never),
        "Integration setup did not reach a terminal state.",
      )
      expect(mockCallTool).toHaveBeenCalledTimes(2)
    })
  })

  test("fails with the stable Core setup error without echoing submitted secrets", async () => {
    const secret = "synthetic-provider-secret-never-echo"
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_setup_integration") {
        expect(JSON.stringify(input)).toContain(secret)
        return setupResult({
          provider: "fireflies",
          name: "Fireflies",
          category: "calls",
          status: "not_connected",
          problem: {
            code: "credential_rejected",
            message: "Provider rejected the submitted credentials.",
            retryable: false,
          },
        })
      }
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const stdinSpy = spyOn(Bun.stdin, "text").mockResolvedValue(
      JSON.stringify({ credentials: { apiKey: secret } }),
    )
    try {
      await runExpectingError(
        () =>
          setup.run!({
            args: { provider: "fireflies", json: true, "config-stdin": true },
          } as never),
        "credential_rejected",
      )
    } finally {
      stdinSpy.mockRestore()
    }
  })

  test("exposes only the supported flags and rejects secret CLI arguments", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    expect(Object.keys(setup.args ?? {})).toEqual([
      "api-key",
      "json",
      "config-stdin",
      "accept-recommended",
      "provider",
    ])

    await runExpectingError(async () => {
      await runCommand(setup, {
        rawArgs: ["fireflies", "--api-key-value", "synthetic-secret", "--json"],
      })
    }, "invalid_input")

    expect(mockCallTool).not.toHaveBeenCalled()
  })
})

async function expectInteractiveError(fn: () => Promise<void>, message: string): Promise<void> {
  const exitSpy = mockExitThrow()
  const errorSpy = spyOn(console, "error").mockImplementation(() => {})
  let thrown: unknown
  let errors: unknown[][] = []
  try {
    await fn()
  } catch (error) {
    thrown = error
  } finally {
    errors = errorSpy.mock.calls
    exitSpy.mockRestore()
    errorSpy.mockRestore()
  }

  expect(thrown).toBeInstanceOf(ExitError)
  expect(errors).toContainEqual([`Error: ${message}`])
}
