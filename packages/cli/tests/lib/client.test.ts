import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { createClient, isPlatformCommandError } from "../../src/lib/client"
import { TEST_API_KEY } from "../helpers"

describe("createClient()", () => {
  let originalEnv: string | undefined
  let originalXdg: string | undefined

  beforeEach(() => {
    originalEnv = process.env.OUTLIT_API_KEY
    originalXdg = process.env.XDG_CONFIG_HOME
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    // Point config dir to a non-existent path so resolveApiKey never finds a credentials file
    process.env.XDG_CONFIG_HOME = "/tmp/outlit-test-no-config"
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OUTLIT_API_KEY = originalEnv
    } else {
      Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    }
    if (originalXdg !== undefined) {
      process.env.XDG_CONFIG_HOME = originalXdg
    } else {
      Reflect.deleteProperty(process.env, "XDG_CONFIG_HOME")
    }
    Reflect.deleteProperty(process.env, "OUTLIT_API_URL")
  })

  test("throws when no API key is found", async () => {
    await expect(createClient()).rejects.toThrow("No API key found")
  })

  test("throws when API key has invalid format", async () => {
    process.env.OUTLIT_API_KEY = "invalid_key_no_ok_prefix"
    await expect(createClient()).rejects.toThrow("Invalid API key format")
  })

  test("throws when API key is too short (prefix only)", async () => {
    process.env.OUTLIT_API_KEY = "ok_short"
    await expect(createClient()).rejects.toThrow("Invalid API key format")
  })

  test("returns client with key and baseUrl when key is valid", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const client = await createClient()
    expect(client.key).toBe(TEST_API_KEY)
    expect(client.baseUrl).toBe("https://app.outlit.ai")
  })

  test("uses OUTLIT_API_URL env var to override base URL", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    process.env.OUTLIT_API_URL = "http://localhost:3000"

    const client = await createClient()
    expect(client.baseUrl).toBe("http://localhost:3000")
  })
})

describe("client.callTool()", () => {
  let savedApiKey: string | undefined

  beforeEach(() => {
    savedApiKey = process.env.OUTLIT_API_KEY
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
  })

  afterEach(() => {
    if (savedApiKey !== undefined) {
      process.env.OUTLIT_API_KEY = savedApiKey
    } else {
      Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
    }
  })

  test("delegates customer tools to the public tools endpoint", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const mockData = { items: [{ id: "1", name: "Acme" }], pagination: { hasMore: false } }
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const client = await createClient()
    const result = await client.callTool("outlit_list_customers", { limit: 10 })
    expect(result).toEqual(mockData)

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/tools/call")

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(opts.method).toBe("POST")
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_list_customers",
      input: { limit: 10 },
    })

    fetchSpy.mockRestore()
  })

  test("keeps integration tools on public integration endpoints", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionId: "session_123" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "connected" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ providers: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "manual_setup_required" }), { status: 200 }),
      )

    const client = await createClient()
    await client.callTool("outlit_list_integrations", { connectedOnly: true })
    await client.callTool("outlit_connect_integration", { provider: "slack" })
    await client.callTool("outlit_connect_status", { sessionId: "session_123" })
    await client.callTool("outlit_integration_sync_status", { provider: "slack" })
    await client.callTool("outlit_integration_capabilities", { provider: "hubspot" })
    await client.callTool("outlit_integration_setup_step", {
      provider: "pylon",
      step: "webhooks",
    })

    expect(fetchSpy.mock.calls[0]?.[0] as string).toContain("/api/integrations?connectedOnly=true")
    expect(fetchSpy.mock.calls[1]?.[0] as string).toContain("/api/integrations/connect")
    expect(fetchSpy.mock.calls[2]?.[0] as string).toContain(
      "/api/integrations/connect/status?sessionId=session_123",
    )
    expect(fetchSpy.mock.calls[3]?.[0] as string).toContain(
      "/api/integrations/sync-status?provider=slack",
    )
    expect(fetchSpy.mock.calls[4]?.[0] as string).toContain(
      "/api/integrations/capabilities?provider=hubspot",
    )
    expect(fetchSpy.mock.calls[5]?.[0] as string).toContain("/api/integrations/setup-step")

    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ provider: "slack" }),
    )
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[4]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[5]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[5]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ provider: "pylon", step: "webhooks" }),
    )

    fetchSpy.mockRestore()
  })

  test("keeps agent platform actions on direct public API endpoints", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const createParams = {
      type: "template",
      templateKey: "churn",
      mode: "draft",
    }
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            commandId: "agent.listTemplates",
            commandVersion: 1,
            correlationId: "corr_templates_123",
            result: {
              operationId: "agent.templates.list",
              status: "completed",
              resources: [],
              data: { templates: [] },
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            commandId: "agent.listAvailableActions",
            commandVersion: 1,
            correlationId: "corr_actions_123",
            result: {
              operationId: "agent.availableActions.list",
              status: "completed",
              resources: [],
              data: { actions: [] },
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            commandId: "agent.create",
            commandVersion: 1,
            correlationId: "corr_123",
            result: {
              operationId: "agent.create",
              status: "completed",
              resources: [{ type: "agent", id: "agent_123" }],
              data: {
                agent: {
                  id: "agent_123",
                  displayName: "Churn prevention",
                  status: "DISABLED",
                },
              },
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            commandId: "agent.list",
            commandVersion: 1,
            correlationId: "corr_list_123",
            result: {
              operationId: "agent.list",
              status: "completed",
              resources: [],
              data: { agents: [] },
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            commandId: "agent.get",
            commandVersion: 1,
            correlationId: "corr_get_123",
            result: {
              operationId: "agent.get",
              status: "completed",
              resources: [{ type: "agent", id: "agent_123" }],
              data: { agent: { id: "agent_123" } },
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            commandId: "automation.list",
            commandVersion: 1,
            correlationId: "corr_automation_list_123",
            result: {
              operationId: "automation.list",
              status: "completed",
              resources: [],
              data: { automations: [] },
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            commandId: "automation.get",
            commandVersion: 1,
            correlationId: "corr_automation_get_123",
            result: {
              operationId: "automation.get",
              status: "completed",
              resources: [{ type: "automation", id: "automation_123" }],
              data: { automation: { id: "automation_123" } },
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            commandId: "signal.list",
            commandVersion: 1,
            correlationId: "corr_signal_list_123",
            result: {
              operationId: "signal.list",
              status: "completed",
              resources: [],
              data: { signals: [] },
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            commandId: "destination.list",
            commandVersion: 1,
            correlationId: "corr_destination_list_123",
            result: {
              operationId: "destination.list",
              status: "completed",
              resources: [],
              data: { destinations: [] },
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      )

    const client = await createClient()
    await client.callTool("outlit_agent_list_templates", {})
    await client.callTool("outlit_agent_list_available_actions", {})
    await client.callTool("outlit_agent_create", createParams)
    await client.callTool("outlit_agent_list", {})
    await client.callTool("outlit_agent_get", { id: "agent_123" })
    await client.callTool("outlit_automation_list", {})
    await client.callTool("outlit_automation_get", { id: "automation_123" })
    await client.callTool("outlit_signal_list", {})
    await client.callTool("outlit_destination_list", {})

    expect(fetchSpy.mock.calls[0]?.[0] as string).toContain("/api/agent-templates")
    expect(fetchSpy.mock.calls[1]?.[0] as string).toContain("/api/agent-actions")
    expect(fetchSpy.mock.calls[2]?.[0] as string).toContain("/api/agents")
    expect(fetchSpy.mock.calls[3]?.[0] as string).toContain("/api/agents")
    expect(fetchSpy.mock.calls[4]?.[0] as string).toContain("/api/agents/agent_123")
    expect(fetchSpy.mock.calls[5]?.[0] as string).toContain("/api/automations")
    expect(fetchSpy.mock.calls[6]?.[0] as string).toContain("/api/automations/automation_123")
    expect(fetchSpy.mock.calls[7]?.[0] as string).toContain("/api/signals")
    expect(fetchSpy.mock.calls[8]?.[0] as string).toContain("/api/destinations")
    for (const call of fetchSpy.mock.calls) {
      expect(call[0] as string).not.toContain("/api/tools/call")
    }

    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).body).toBe(JSON.stringify(createParams))
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[4]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[4]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[5]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[5]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[6]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[6]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[7]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[7]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[8]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[8]?.[1] as RequestInit).body).toBeUndefined()

    fetchSpy.mockRestore()
  })

  test("does not expose destructive disconnect through the CLI tool map", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const client = await createClient()
    await expect(
      client.callTool("outlit_disconnect_integration", { provider: "slack" }),
    ).rejects.toThrow("Unknown tool")
  })

  test("keeps option and agent run platform actions on direct public API endpoints", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const okEnvelope = {
      ok: true,
      commandId: "options.runs.test",
      commandVersion: 1,
      correlationId: "corr_options_runs_123",
      result: {
        operationId: "options.runs.test",
        status: "completed",
        resources: [],
        data: {},
        warnings: [],
      },
    }
    const fetchSpy = spyOn(globalThis, "fetch")
    for (let i = 0; i < 8; i += 1) {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(okEnvelope), { status: 200 }))
    }

    const client = await createClient()
    await client.callTool("outlit_automation_options", {})
    await client.callTool("outlit_signal_options", {})
    await client.callTool("outlit_destination_options", { search: "ops", limit: 10 })
    await client.callTool("outlit_agent_run_start", {
      agentId: "agent_123",
      clientRequestId: "request_123",
    })
    await client.callTool("outlit_agent_run_list", {
      agentId: "agent_123",
      limit: 5,
      cursor: "cursor_123",
    })
    await client.callTool("outlit_agent_run_get", {
      agentId: "agent_123",
      runId: "run_123",
    })
    await client.callTool("outlit_automation_run_list", {
      automationId: "10000000-0000-4000-8000-000000000001",
      limit: 5,
      cursor: "cursor_123",
    })
    await client.callTool("outlit_automation_run_get", {
      automationId: "10000000-0000-4000-8000-000000000001",
      runId: "10000000-0000-4000-8000-000000000006",
    })

    const urls = fetchSpy.mock.calls.map((call) => call[0] as string)
    expect(urls[0]).toContain("/api/automations/options")
    expect(urls[1]).toContain("/api/signals/options")
    expect(urls[2]).toContain("/api/destinations/options?search=ops&limit=10")
    expect(urls[3]).toContain("/api/agents/agent_123/runs")
    expect(urls[4]).toContain("/api/agents/agent_123/runs?limit=5&cursor=cursor_123")
    expect(urls[5]).toContain("/api/agents/agent_123/runs/run_123")
    expect(urls[6]).toContain(
      "/api/automations/10000000-0000-4000-8000-000000000001/runs?limit=5&cursor=cursor_123",
    )
    expect(urls[7]).toContain(
      "/api/automations/10000000-0000-4000-8000-000000000001/runs/10000000-0000-4000-8000-000000000006",
    )

    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ clientRequestId: "request_123" }),
    )
    expect((fetchSpy.mock.calls[4]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[5]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[6]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[7]?.[1] as RequestInit).method).toBe("GET")
    for (const url of urls) {
      expect(url).not.toContain("/api/tools/call")
    }

    fetchSpy.mockRestore()
  })

  test("keeps settings platform actions on direct public API endpoints", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const okEnvelope = {
      ok: true,
      commandId: "settings.test",
      commandVersion: 1,
      correlationId: "corr_settings_123",
      result: {
        operationId: "settings.test",
        status: "completed",
        resources: [],
        data: {},
        warnings: [],
      },
    }
    const fetchSpy = spyOn(globalThis, "fetch")
    for (let i = 0; i < 5; i += 1) {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(okEnvelope), { status: 200 }))
    }

    const client = await createClient()
    await client.callTool("outlit_settings_get", {})
    await client.callTool("outlit_settings_update", {
      defaultTimezone: "America/Los_Angeles",
    })
    await client.callTool("outlit_settings_report_get", {})
    await client.callTool("outlit_settings_report_update", {
      slackChannelId: "C123",
      slackChannelName: "sales-alerts",
    })
    await client.callTool("outlit_settings_report_options", { search: "sales", limit: 10 })

    const urls = fetchSpy.mock.calls.map((call) => call[0] as string)
    expect(urls[0]).toContain("/api/settings")
    expect(urls[1]).toContain("/api/settings")
    expect(urls[2]).toContain("/api/settings/report")
    expect(urls[3]).toContain("/api/settings/report")
    expect(urls[4]).toContain("/api/settings/report/options?search=sales&limit=10")
    expect(urls).not.toEqual(
      expect.arrayContaining([expect.stringContaining("/api/settings/notifications")]),
    )
    expect(urls).not.toEqual(expect.arrayContaining([expect.stringContaining("default")]))

    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).method).toBe("PATCH")
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ defaultTimezone: "America/Los_Angeles" }),
    )
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).method).toBe("PATCH")
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).body).toBe(
      JSON.stringify({
        slackChannelId: "C123",
        slackChannelName: "sales-alerts",
      }),
    )
    expect((fetchSpy.mock.calls[4]?.[1] as RequestInit).method).toBe("GET")
    for (const url of urls) {
      expect(url).not.toContain("/api/tools/call")
    }

    fetchSpy.mockRestore()
  })

  test("keeps identity merge suggestion platform actions on direct public API endpoints", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const okEnvelope = {
      ok: true,
      commandId: "identity.mergeSuggestion.test",
      commandVersion: 1,
      correlationId: "corr_identity_123",
      result: {
        operationId: "identity.mergeSuggestion.test",
        status: "completed",
        resources: [],
        data: {},
        warnings: [],
      },
    }
    const fetchSpy = spyOn(globalThis, "fetch")
    for (let i = 0; i < 4; i += 1) {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(okEnvelope), { status: 200 }))
    }

    const client = await createClient()
    await client.callTool("outlit_identity_merge_suggestion_list", {
      status: "suggested",
      confidence: "HIGH",
      limit: 5,
    })
    await client.callTool("outlit_identity_merge_suggestion_get", { id: "proposal_123" })
    await client.callTool("outlit_identity_merge_suggestion_queue", {
      id: "proposal_123",
      reviewNotes: "reviewed by agent",
    })
    await client.callTool("outlit_identity_merge_suggestion_reject", { id: "proposal_123" })

    const urls = fetchSpy.mock.calls.map((call) => call[0] as string)
    expect(urls[0]).toContain(
      "/api/identity/merge-suggestions?status=suggested&confidence=HIGH&limit=5",
    )
    expect(urls[1]).toContain("/api/identity/merge-suggestions/proposal_123")
    expect(urls[2]).toContain("/api/identity/merge-suggestions/proposal_123/queue")
    expect(urls[3]).toContain("/api/identity/merge-suggestions/proposal_123/reject")

    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ reviewNotes: "reviewed by agent" }),
    )
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[3]?.[1] as RequestInit).body).toBe(JSON.stringify({}))
    for (const url of urls) {
      expect(url).not.toContain("/api/tools/call")
    }

    fetchSpy.mockRestore()
  })

  test("keeps lifecycle platform actions on direct public API endpoints", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const okEnvelope = {
      ok: true,
      commandId: "lifecycle.test",
      commandVersion: 1,
      correlationId: "corr_lifecycle_123",
      result: {
        operationId: "lifecycle.test",
        status: "completed",
        resources: [],
        data: {},
        warnings: [],
      },
    }
    const fetchSpy = spyOn(globalThis, "fetch")
    for (let i = 0; i < 22; i += 1) {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(okEnvelope), { status: 200 }))
    }

    const client = await createClient()
    await client.callTool("outlit_agent_enable", { id: "agent_123" })
    await client.callTool("outlit_agent_disable", { id: "agent_123" })
    await client.callTool("outlit_agent_rename", { id: "agent_123", displayName: "Renamed" })
    await client.callTool("outlit_automation_enable", {
      id: "10000000-0000-4000-8000-000000000001",
    })
    await client.callTool("outlit_automation_disable", {
      id: "10000000-0000-4000-8000-000000000001",
    })
    await client.callTool("outlit_automation_archive", {
      id: "10000000-0000-4000-8000-000000000001",
    })
    await client.callTool("outlit_signal_get", {
      id: "10000000-0000-4000-8000-000000000002",
    })
    await client.callTool("outlit_signal_archive", {
      id: "10000000-0000-4000-8000-000000000002",
    })
    await client.callTool("outlit_destination_get", {
      id: "10000000-0000-4000-8000-000000000003",
    })
    await client.callTool("outlit_destination_enable", {
      id: "10000000-0000-4000-8000-000000000003",
    })
    await client.callTool("outlit_destination_disable", {
      id: "10000000-0000-4000-8000-000000000003",
    })
    await client.callTool("outlit_destination_archive", {
      id: "10000000-0000-4000-8000-000000000003",
    })
    await client.callTool("outlit_agent_create", {
      type: "custom",
      displayName: "Renewal risk",
      instructions: "Find risky customers and skip already resolved issues.",
      maxItemsToSurface: 10,
      actionKeys: ["send_slack_notification"],
    })
    await client.callTool("outlit_agent_update", {
      id: "agent_123",
      displayName: "Renewal risk",
    })
    await client.callTool("outlit_agent_update", {
      id: "agent_123",
      instructions: "New instructions",
    })
    await client.callTool("outlit_agent_update", {
      id: "agent_123",
      actionKeys: ["send_slack_notification"],
    })
    await client.callTool("outlit_automation_create", {
      agentId: "10000000-0000-4000-8000-000000000004",
      name: "Churn response",
      description: null,
      enabled: false,
      triggerType: "SIGNAL_OCCURRENCE",
      signalIds: [],
      destinationIds: [],
    })
    await client.callTool("outlit_automation_update", {
      id: "10000000-0000-4000-8000-000000000001",
      agentId: "10000000-0000-4000-8000-000000000004",
      name: "Churn response",
      description: null,
      enabled: false,
      triggerType: "SIGNAL_OCCURRENCE",
      signalIds: [],
      destinationIds: [],
    })
    await client.callTool("outlit_signal_create", {
      kind: "EVENT_MATCH",
      name: "Workspace inactive",
      description: null,
      definition: {
        grain: "customer",
        subjectResolver: "event_customer",
        eventNames: ["workspace_inactive"],
        propertyConditions: [],
        conditionMode: "ALL",
      },
    })
    await client.callTool("outlit_signal_update", {
      id: "10000000-0000-4000-8000-000000000002",
      kind: "EVENT_MATCH",
      name: "Workspace inactive",
      description: null,
      definition: {
        grain: "customer",
        subjectResolver: "event_customer",
        eventNames: ["workspace_inactive"],
        propertyConditions: [],
        conditionMode: "ALL",
      },
    })
    await client.callTool("outlit_destination_create", {
      type: "SLACK_CHANNEL",
      channelId: "C0123456789",
      label: "#customer-ops",
      enabled: true,
    })
    await client.callTool("outlit_destination_update", {
      id: "10000000-0000-4000-8000-000000000003",
      type: "SLACK_CHANNEL",
      label: "#customer-ops",
      enabled: true,
    })

    const urls = fetchSpy.mock.calls.map((call) => call[0] as string)
    expect(urls[0]).toContain("/api/agents/agent_123/enable")
    expect(urls[1]).toContain("/api/agents/agent_123/disable")
    expect(urls[2]).toContain("/api/agents/agent_123/rename")
    expect(urls[3]).toContain("/api/automations/10000000-0000-4000-8000-000000000001/enable")
    expect(urls[4]).toContain("/api/automations/10000000-0000-4000-8000-000000000001/disable")
    expect(urls[5]).toContain("/api/automations/10000000-0000-4000-8000-000000000001/archive")
    expect(urls[6]).toContain("/api/signals/10000000-0000-4000-8000-000000000002")
    expect(urls[7]).toContain("/api/signals/10000000-0000-4000-8000-000000000002/archive")
    expect(urls[8]).toContain("/api/destinations/10000000-0000-4000-8000-000000000003")
    expect(urls[9]).toContain("/api/destinations/10000000-0000-4000-8000-000000000003/enable")
    expect(urls[10]).toContain("/api/destinations/10000000-0000-4000-8000-000000000003/disable")
    expect(urls[11]).toContain("/api/destinations/10000000-0000-4000-8000-000000000003/archive")
    expect(urls[12]).toContain("/api/agents")
    expect(urls[13]).toContain("/api/agents/agent_123")
    expect(urls[14]).toContain("/api/agents/agent_123")
    expect(urls[15]).toContain("/api/agents/agent_123")
    expect(urls[16]).toContain("/api/automations")
    expect(urls[17]).toContain("/api/automations/10000000-0000-4000-8000-000000000001")
    expect(urls[18]).toContain("/api/signals")
    expect(urls[19]).toContain("/api/signals/10000000-0000-4000-8000-000000000002")
    expect(urls[20]).toContain("/api/destinations")
    expect(urls[21]).toContain("/api/destinations/10000000-0000-4000-8000-000000000003")

    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).body).toBe(JSON.stringify({}))
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ displayName: "Renamed" }),
    )
    expect((fetchSpy.mock.calls[6]?.[1] as RequestInit).method).toBe("GET")
    expect((fetchSpy.mock.calls[6]?.[1] as RequestInit).body).toBeUndefined()
    expect((fetchSpy.mock.calls[12]?.[1] as RequestInit).method).toBe("POST")
    expect((fetchSpy.mock.calls[12]?.[1] as RequestInit).body).toBe(
      JSON.stringify({
        type: "custom",
        displayName: "Renewal risk",
        instructions: "Find risky customers and skip already resolved issues.",
        maxItemsToSurface: 10,
        actionKeys: ["send_slack_notification"],
      }),
    )
    expect((fetchSpy.mock.calls[13]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ displayName: "Renewal risk" }),
    )
    expect((fetchSpy.mock.calls[13]?.[1] as RequestInit).method).toBe("PATCH")
    expect((fetchSpy.mock.calls[17]?.[1] as RequestInit).method).toBe("PATCH")
    expect((fetchSpy.mock.calls[19]?.[1] as RequestInit).method).toBe("PATCH")
    expect((fetchSpy.mock.calls[21]?.[1] as RequestInit).method).toBe("PATCH")
    expect((fetchSpy.mock.calls[17]?.[1] as RequestInit).body).toBe(
      JSON.stringify({
        agentId: "10000000-0000-4000-8000-000000000004",
        name: "Churn response",
        description: null,
        enabled: false,
        triggerType: "SIGNAL_OCCURRENCE",
        signalIds: [],
        destinationIds: [],
      }),
    )
    for (const url of urls) {
      expect(url).not.toContain("/api/tools/call")
    }

    fetchSpy.mockRestore()
  })

  test("delegates exact fact retrieval through the public tools endpoint", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ fact: { id: "fact_123" } }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_get_fact", {
      factId: "fact_123",
      include: ["evidence"],
    })

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/tools/call")

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_get_fact",
      input: {
        factId: "fact_123",
        include: ["evidence"],
      },
    })

    fetchSpy.mockRestore()
  })

  test("delegates exact source retrieval through the public tools endpoint", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ source: { sourceType: "CALL" } }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_get_source", {
      sourceType: "CALL",
      sourceId: "call_123",
    })

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/tools/call")

    fetchSpy.mockRestore()
  })

  test("includes Authorization header with Bearer token", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_list_customers", {})

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const headers = opts.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`)

    fetchSpy.mockRestore()
  })

  test("throws on HTTP error response", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    )

    const client = await createClient()
    await expect(client.callTool("outlit_list_customers", {})).rejects.toThrow("API error (401)")
    fetchSpy.mockRestore()
  })

  test("preserves structured platform command error envelopes", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY
    const commandEnvelope = {
      ok: false,
      commandId: "agent.create",
      commandVersion: 1,
      error: {
        code: "authorization_denied",
        message: "API key is missing the required agents:write scope.",
        correlationId: "corr_denied_123",
        retryable: false,
        details: { requiredScope: "agents:write" },
      },
    } as const
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(commandEnvelope), { status: 403 }),
    )

    const client = await createClient()
    let thrown: unknown
    try {
      await client.callTool("outlit_agent_create", {
        type: "template",
        templateKey: "churn",
        mode: "draft",
      })
    } catch (error) {
      thrown = error
    }

    expect(isPlatformCommandError(thrown)).toBe(true)
    if (!isPlatformCommandError(thrown)) {
      throw new Error("expected platform command error")
    }
    expect(thrown.status).toBe(403)
    expect(thrown.commandEnvelope).toEqual(commandEnvelope)
    fetchSpy.mockRestore()
  })

  test("throws on unknown tool name", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const client = await createClient()
    await expect(client.callTool("nonexistent_tool", {})).rejects.toThrow("Unknown tool")
  })

  test("passes customer tool input through the public tool request body", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_list_customers", {
      limit: 10,
      search: null,
      cursor: undefined,
    })

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_list_customers",
      input: {
        limit: 10,
        search: null,
        cursor: undefined,
      },
    })

    fetchSpy.mockRestore()
  })

  test("passes object params through customer tool request bodies", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_list_customers", {
      traitFilters: { segment: "enterprise", active: true, seats: 25 },
    })

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_list_customers",
      input: {
        traitFilters: { segment: "enterprise", active: true, seats: 25 },
      },
    })

    fetchSpy.mockRestore()
  })

  test("delegates search through the public tools endpoint", async () => {
    process.env.OUTLIT_API_KEY = TEST_API_KEY

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    const client = await createClient()
    await client.callTool("outlit_search_customer_context", {
      query: "pricing",
      sourceType: "CALL",
      sourceId: "call_123",
    })

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("/api/tools/call")

    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body).toEqual({
      tool: "outlit_search_customer_context",
      input: {
        query: "pricing",
        sourceType: "CALL",
        sourceId: "call_123",
      },
    })

    fetchSpy.mockRestore()
  })
})
