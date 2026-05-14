import {
  installChildProcessMock,
  mockExecFileSync,
  resetChildProcessMocks,
} from "../child-process-mock"

installChildProcessMock()

mock.module("../../src/lib/client", () => ({
  createClient: async (apiKey?: string) => ({
    key: apiKey ?? process.env.OUTLIT_API_KEY ?? "",
    baseUrl: process.env.OUTLIT_API_URL ?? "https://app.outlit.ai",
    async callTool(toolName: string) {
      const key = apiKey ?? process.env.OUTLIT_API_KEY ?? ""
      const endpoint =
        toolName === "outlit_integration_capabilities"
          ? "/api/integrations/capabilities"
          : "/api/integrations"
      const response = await globalThis.fetch(`https://app.outlit.ai${endpoint}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
      })
      return response.json()
    },
  }),
}))

import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

setNonInteractive()

const capabilitiesPayload = {
  providers: [
    {
      cliName: "hubspot",
      providerId: "hubspot",
      setupMode: "nango_connect",
      credentialType: "oauth",
      connectSupported: true,
      requiredFields: [],
      postConnectSteps: [{ id: "crm-mapping", required: true, supported: false }],
    },
    {
      cliName: "pylon",
      providerId: "pylon",
      setupMode: "direct_api_key",
      credentialType: "api_token",
      connectSupported: true,
      requiredFields: [{ key: "apiToken", label: "API Token", secret: true }],
      postConnectSteps: [{ id: "webhook-setup", required: true, supported: false }],
    },
  ],
}

const integrationsPayload = {
  items: [
    { id: "pylon", name: "Pylon", status: "connected" },
    { id: "hubspot", name: "HubSpot", status: "available" },
  ],
}

describe("onboard", () => {
  useTempEnv("onboard-test")

  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    resetChildProcessMocks()
    fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ valid: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(capabilitiesPayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(integrationsPayload), { status: 200 }))
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test("prepares an agent without attempting integration setup", async () => {
    const { default: onboardCmd } = await import("../../src/commands/onboard")
    const parsed = await captureStdout<{
      status: string
      agent: string
      checks: Array<{ name: string; status: string; runner?: string }>
      integrations: {
        capabilitiesAvailable: boolean
        providerCount: number
        connectedCount: number
        setupModes: Record<string, number>
      }
      nextActions: string[]
    }>(() =>
      onboardCmd.run!({
        args: { agent: "codex", json: true },
      } as Parameters<NonNullable<typeof onboardCmd.run>>[0]),
    )

    const fetchInit = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
    expect(fetchInit?.headers).toEqual({ Authorization: `Bearer ${TEST_API_KEY}` })
    expect(fetchUrls(fetchSpy)).toEqual([
      "https://app.outlit.ai/api/validate-api-key",
      "https://app.outlit.ai/api/integrations/capabilities",
      "https://app.outlit.ai/api/integrations",
    ])
    expect(mockExecFileSync.mock.calls.length).toBe(2)
    const [runnerCmd, runnerArgs] = mockExecFileSync.mock.calls[1] as [string, string[]]
    expect(runnerCmd).toBe("npx")
    expect(runnerArgs).toEqual([
      "-y",
      "skills",
      "add",
      "https://github.com/OutlitAI/outlit-agent-skills",
      "--skill",
      "outlit",
      "--agent",
      "codex",
      "-y",
      "-g",
    ])

    expect(parsed.status).toBe("ready")
    expect(parsed.agent).toBe("codex")
    expect(parsed.checks).toContainEqual(
      expect.objectContaining({ name: "API key", status: "pass" }),
    )
    expect(parsed.checks).toContainEqual(
      expect.objectContaining({ name: "Outlit skill", status: "pass", runner: "npx" }),
    )
    expect(parsed.checks).toContainEqual(
      expect.objectContaining({ name: "Integration capabilities", status: "pass" }),
    )
    expect(parsed.integrations).toMatchObject({
      capabilitiesAvailable: true,
      providerCount: 2,
      connectedCount: 1,
      setupModes: {
        nango_connect: 1,
        direct_api_key: 1,
      },
    })
    expect(parsed.nextActions).toContain("outlit doctor --json")
    expect(parsed.nextActions).toContain("outlit integrations capabilities --json")
    expect(parsed.nextActions).toContain("outlit integrations setup <provider> --json")
  })

  test("starts browser auth when no API key exists", async () => {
    const originalCi = process.env.CI
    const originalGithubActions = process.env.GITHUB_ACTIONS
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    Reflect.deleteProperty(process.env, "CI")
    Reflect.deleteProperty(process.env, "GITHUB_ACTIONS")
    fetchSpy.mockRestore()
    fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requestId: "req_123",
            pollToken: "poll_123",
            userCode: "ABCD-EFGH",
            approveUrl: "https://app.outlit.ai/cli-auth/approve?request=req_123",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            intervalSeconds: 0,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "approved",
            apiKey: TEST_API_KEY,
            keyPrefix: "ok_aa",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ valid: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(capabilitiesPayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(integrationsPayload), { status: 200 }))

    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    try {
      const { default: onboardCmd } = await import("../../src/commands/onboard")
      const parsed = await captureStdout<{
        status: string
        checks: Array<{ name: string; status: string; message: string }>
      }>(() =>
        onboardCmd.run!({
          args: { agent: "codex", json: true },
        } as Parameters<NonNullable<typeof onboardCmd.run>>[0]),
      )

      expect(fetchUrls(fetchSpy)).toEqual([
        "https://app.outlit.ai/api/cli-auth/start",
        "https://app.outlit.ai/api/cli-auth/poll",
        "https://app.outlit.ai/api/validate-api-key",
        "https://app.outlit.ai/api/integrations/capabilities",
        "https://app.outlit.ai/api/integrations",
      ])
      expect(parsed.status).toBe("ready")
      expect(parsed.checks).toContainEqual(
        expect.objectContaining({
          name: "Authentication",
          status: "pass",
          message: "Browser authorization approved",
        }),
      )
    } finally {
      stderrSpy.mockRestore()
      restoreEnv("CI", originalCi)
      restoreEnv("GITHUB_ACTIONS", originalGithubActions)
    }
  })

  test("requires an explicit agent flag", async () => {
    const { default: onboardCmd } = await import("../../src/commands/onboard")
    await runExpectingError(
      () =>
        onboardCmd.run!({
          args: { json: true },
        } as Parameters<NonNullable<typeof onboardCmd.run>>[0]),
      "agent_required",
    )
  })

  test("rejects unknown agents", async () => {
    const { default: onboardCmd } = await import("../../src/commands/onboard")
    await runExpectingError(
      () =>
        onboardCmd.run!({
          args: { agent: "unknown", json: true },
        } as Parameters<NonNullable<typeof onboardCmd.run>>[0]),
      "unknown_agent",
    )
  })
})

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name)
  } else {
    process.env[name] = value
  }
}

function fetchUrls(spy: ReturnType<typeof spyOn>): string[] {
  const calls = spy.mock.calls as Array<[unknown, RequestInit?]>
  return calls.map((call) => String(call[0]))
}
