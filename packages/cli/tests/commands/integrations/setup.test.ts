import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
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
  isCiEnvironment: () => false,
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

function capability(provider: string) {
  const humanControlled = provider === "pylon"
  return {
    provider,
    name: provider === "stripe" ? "Stripe" : humanControlled ? "Pylon" : "HubSpot",
    category: provider === "stripe" ? "billing" : humanControlled ? "support" : "crm",
    authType: humanControlled ? "api_key" : "oauth",
    setupMode: humanControlled ? "human_controlled" : "browser_handoff",
    browserHandoffAvailable: !humanControlled,
  }
}

function setupResult(
  overrides: Partial<{
    provider: string
    name: string
    category: string
    status: string
    next: unknown
    error: unknown
  }> = {},
) {
  return {
    provider: "hubspot",
    name: "HubSpot",
    category: "crm",
    status: "ready",
    next: null,
    error: null,
    ...overrides,
  }
}

const mockCallTool = mock(async (toolName: string, input: ToolInput): Promise<unknown> => {
  if (toolName === "outlit_get_integration_capabilities") {
    const provider = String(input.provider)
    return { providers: [capability(provider)], preferredSetupVersion: 1 }
  }
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
      if (toolName === "outlit_get_integration_capabilities") {
        const provider = String(input.provider)
        return { providers: [capability(provider)], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration") {
        return setupResult({ provider: String(input.provider) })
      }
      throw new Error(`unexpected tool ${toolName}`)
    })
  })

  test("probes preferred setup support before making a secretless setup call", async () => {
    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const result = await captureStdout(() =>
      setup.run!({ args: { provider: "hubspot", json: true } } as never),
    )

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_get_integration_capabilities", {
      provider: "hubspot",
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_setup_integration", {
      provider: "hubspot",
    })
    expect(result).toEqual(setupResult())
  })

  test("uses the old-Core browser fallback without sending provider configuration", async () => {
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))] }
      }
      if (toolName === "outlit_begin_integration_setup") {
        return {
          provider: input.provider,
          state: "handoff_ready",
          sessionId: "00000000-0000-4000-8000-000000000001",
          connectUrl: "https://app.outlit.ai/integrations/connect",
          expiresAt: "2026-08-04T22:00:00.000Z",
        }
      }
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await captureStdout(() => setup.run!({ args: { provider: "hubspot", json: true } } as never))

    expect(mockCallTool).toHaveBeenCalledTimes(2)
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_begin_integration_setup", {
      provider: "hubspot",
    })
  })

  test.each([
    ["--config-stdin", { "config-stdin": true }],
    ["--accept-recommended", { "accept-recommended": true }],
  ])("rejects %s on old Core before reading or transmitting input", async (_flag, flagArgs) => {
    const secret = "synthetic-legacy-secret-never-read"
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))] }
      }
      if (toolName === "outlit_begin_integration_setup") {
        return {
          provider: input.provider,
          state: "handoff_ready",
          sessionId: "00000000-0000-4000-8000-000000000001",
          connectUrl: "https://app.outlit.ai/integrations/connect",
          expiresAt: "2026-08-04T22:00:00.000Z",
        }
      }
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const stdinSpy = spyOn(Bun.stdin, "text").mockResolvedValue(
      JSON.stringify({ credentials: { apiKey: secret } }),
    )
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    let thrown: unknown
    let stderrWritten = ""
    try {
      await setup.run!({
        args: { provider: "hubspot", json: true, ...flagArgs },
      } as never)
    } catch (error) {
      thrown = error
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      stdinSpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect(JSON.parse(stderrWritten)).toMatchObject({ code: "unsupported_core_version" })
    expect(stderrWritten).not.toContain(secret)
    expect(stdinSpy).not.toHaveBeenCalled()
    expect(mockCallTool).toHaveBeenCalledTimes(1)
    expect(mockOpenBrowser).not.toHaveBeenCalled()
  })

  test.each([
    ["a missing handoff URL", null],
    ["an untrusted handoff URL", "https://untrusted.example/connect"],
  ])("fails the legacy spinner before reporting %s", async (_case, connectUrl) => {
    setInteractive()
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))] }
      }
      if (toolName === "outlit_begin_integration_setup") {
        return {
          provider: input.provider,
          state: "handoff_ready",
          sessionId: null,
          connectUrl,
          expiresAt: null,
        }
      }
      throw new Error(`unexpected tool ${toolName}`)
    })

    const events: string[] = []
    mockSpinnerFail.mockImplementationOnce(() => {
      events.push("spinner.fail")
    })
    const errorSpy = spyOn(console, "error").mockImplementation(() => {
      events.push("outputError")
    })
    const exitSpy = mockExitThrow()
    let thrown: unknown
    try {
      const { default: setup } = await import("../../../src/commands/integrations/setup")
      await setup.run!({ args: { provider: "hubspot" } } as never)
    } catch (error) {
      thrown = error
    } finally {
      errorSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(ExitError)
    expect(events).toEqual(["spinner.fail", "outputError"])
  })

  test.each([
    ["timeout", new MockIntegrationAuthTimeoutError(), "AUTH_TIMEOUT"],
    ["expired", new MockIntegrationAuthError("expired"), "AUTH_TIMEOUT"],
    ["failed", new MockIntegrationAuthError("failed"), "AUTH_FAILED"],
    ["unexpected error", new Error("unexpected poll failure"), "AUTH_FAILED"],
  ])("maps a legacy %s poll outcome conservatively", async (_case, pollError, expectedCode) => {
    setInteractive()
    mockWaitForIntegrationConnection.mockImplementationOnce(async () => {
      throw pollError
    })
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))] }
      }
      if (toolName === "outlit_begin_integration_setup") {
        return {
          provider: input.provider,
          state: "handoff_ready",
          sessionId: "00000000-0000-4000-8000-000000000001",
          connectUrl: "https://app.outlit.ai/integrations/connect",
          expiresAt: "2026-08-04T22:00:00.000Z",
        }
      }
      throw new Error(`unexpected tool ${toolName}`)
    })

    const outputModule = await import("../../../src/lib/output")
    let capturedError: { message: string; code?: string } | undefined
    const outputErrorSpy = spyOn(outputModule, "outputError").mockImplementation(((error: {
      message: string
      code?: string
    }) => {
      capturedError = error
      throw new ExitError(1)
    }) as typeof outputModule.outputError)
    try {
      const { default: setup } = await import("../../../src/commands/integrations/setup")
      await expect(setup.run!({ args: { provider: "hubspot" } } as never)).rejects.toBeInstanceOf(
        ExitError,
      )
    } finally {
      outputErrorSpy.mockRestore()
    }

    expect(capturedError?.code).toBe(expectedCode)
  })

  test("returns an OAuth handoff unchanged in JSON without opening or polling", async () => {
    const handoff = setupResult({
      provider: "stripe",
      name: "Stripe",
      category: "billing",
      status: "awaiting_auth",
      next: {
        kind: "browser_handoff",
        purpose: "authentication",
        url: "https://app.outlit.ai/integrations/connect",
        sessionId: "00000000-0000-4000-8000-000000000001",
        expiresAt: "2026-08-04T22:00:00.000Z",
      },
    })
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
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
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration") {
        return setupResult({
          provider: "fireflies",
          name: "Fireflies",
          category: "calls",
          status: "not_connected",
          error: {
            code: "CREDENTIAL_REQUIRED",
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
      "CREDENTIAL_REQUIRED",
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

    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_setup_integration", {
      provider: "mixpanel",
      ...config,
    })
    expect(mockPassword).not.toHaveBeenCalled()
  })

  test("submits the exact displayed CRM recommendation when explicitly accepted", async () => {
    const recommendation = [
      {
        pipelineId: "default",
        pipelineName: "Sales",
        mappings: [{ outlitStage: "Won", crmStages: [{ id: "closedwon", name: "Closed Won" }] }],
      },
    ]
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration" && !input.configuration) {
        return setupResult({
          status: "setup_required",
          next: { kind: "crm_mapping", recommendation },
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

    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_setup_integration", {
      provider: "hubspot",
      configuration: { kind: "crm_mapping", mappings: recommendation, confirm: true },
    })
    expect(result).toEqual(setupResult())
  })

  test("accepts the CRM recommendation without prompting when the interactive flag is set", async () => {
    setInteractive()
    const recommendation = [
      {
        pipelineId: "default",
        pipelineName: "Sales",
        mappings: [{ outlitStage: "Won", crmStages: [] }],
      },
    ]
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration" && !input.configuration) {
        return setupResult({
          status: "setup_required",
          next: { kind: "crm_mapping", recommendation },
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
    expect(mockCallTool).toHaveBeenNthCalledWith(3, "outlit_setup_integration", {
      provider: "hubspot",
      configuration: { kind: "crm_mapping", mappings: recommendation, confirm: true },
    })
  })

  test("bounds an interactive OAuth to post-auth CRM flow at three setup calls", async () => {
    setInteractive()
    const recommendation = [
      {
        pipelineId: "default",
        pipelineName: "Sales",
        mappings: [{ outlitStage: "Created", crmStages: [] }],
      },
    ]
    let setupCalls = 0
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName !== "outlit_setup_integration") throw new Error(`unexpected tool ${toolName}`)
      setupCalls += 1
      if (setupCalls === 1) {
        return setupResult({
          status: "awaiting_auth",
          next: {
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
          next: { kind: "crm_mapping", recommendation },
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
  })

  test("treats external setup handoff as terminal and never polls", async () => {
    const handoff = setupResult({
      provider: "pylon",
      name: "Pylon",
      category: "support",
      status: "setup_required",
      next: {
        kind: "browser_handoff",
        purpose: "external_setup",
        url: "https://app.outlit.ai/integrations/pylon",
        sessionId: null,
        expiresAt: null,
      },
    })
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration") return handoff
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    const result = await captureStdout(() =>
      setup.run!({ args: { provider: "pylon", json: true } } as never),
    )

    expect(result).toEqual(handoff)
    expect(mockWaitForIntegrationConnection).not.toHaveBeenCalled()
    expect(mockCallTool).toHaveBeenCalledTimes(2)
  })

  test("stalls instead of prompting twice for credentials", async () => {
    setInteractive()
    const credentialRequired = setupResult({
      provider: "fireflies",
      name: "Fireflies",
      category: "calls",
      status: "not_connected",
      error: {
        code: "CREDENTIAL_REQUIRED",
        message: "Provider credentials are required to continue setup.",
        retryable: false,
      },
    })
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration") return credentialRequired
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await expectInteractiveError(
      () => setup.run!({ args: { provider: "fireflies" } } as never),
      "Integration setup did not reach a terminal state.",
    )

    expect(mockPassword).toHaveBeenCalledTimes(1)
    expect(mockCallTool).toHaveBeenCalledTimes(3)
  })

  test("exits nonzero when a credential prompt is cancelled", async () => {
    setInteractive()
    mockPassword.mockResolvedValueOnce(promptCancelled as never)
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration") {
        return setupResult({
          provider: "fireflies",
          name: "Fireflies",
          category: "calls",
          status: "not_connected",
          error: {
            code: "CREDENTIAL_REQUIRED",
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

    expect(mockCallTool).toHaveBeenCalledTimes(2)
  })

  test("exits nonzero when CRM mapping confirmation is cancelled", async () => {
    setInteractive()
    mockConfirm.mockResolvedValueOnce(promptCancelled as never)
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration") {
        return setupResult({
          status: "setup_required",
          next: {
            kind: "crm_mapping",
            recommendation: [
              {
                pipelineId: "default",
                pipelineName: "Sales",
                mappings: [{ outlitStage: "Won", crmStages: [] }],
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

    expect(mockCallTool).toHaveBeenCalledTimes(2)
  })

  test("stalls when Mixpanel requests a second mapping transition", async () => {
    setInteractive()
    mockSelect.mockResolvedValueOnce("group_key").mockResolvedValueOnce("company_id")
    const mappingRequired = setupResult({
      provider: "mixpanel",
      name: "Mixpanel",
      category: "analytics",
      status: "setup_required",
      next: {
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
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration") return mappingRequired
      throw new Error(`unexpected tool ${toolName}`)
    })

    const { default: setup } = await import("../../../src/commands/integrations/setup")
    await expectInteractiveError(
      () => setup.run!({ args: { provider: "mixpanel" } } as never),
      "Integration setup did not reach a terminal state.",
    )

    expect(mockCallTool).toHaveBeenCalledTimes(3)
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
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName !== "outlit_setup_integration") throw new Error(`unexpected tool ${toolName}`)
      setupCalls += 1
      if (setupCalls === 1) {
        return setupResult({
          provider: "mixpanel",
          name: "Mixpanel",
          category: "analytics",
          status: "setup_required",
          next: { kind: "mixpanel_mapping", preview },
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

  test("fails with the stable Core setup error without echoing submitted secrets", async () => {
    const secret = "synthetic-provider-secret-never-echo"
    mockCallTool.mockImplementation(async (toolName: string, input: ToolInput) => {
      if (toolName === "outlit_get_integration_capabilities") {
        return { providers: [capability(String(input.provider))], preferredSetupVersion: 1 }
      }
      if (toolName === "outlit_setup_integration") {
        expect(JSON.stringify(input)).toContain(secret)
        return setupResult({
          provider: "fireflies",
          name: "Fireflies",
          category: "calls",
          status: "not_connected",
          error: {
            code: "CREDENTIAL_REJECTED",
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
        "CREDENTIAL_REJECTED",
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
