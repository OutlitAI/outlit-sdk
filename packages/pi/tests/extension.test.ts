import { defaultToolNames, getPublicToolContract } from "@outlit/tools"
import { describe, expect, test, vi } from "vitest"

import {
  allPublicToolNames,
  createOutlitPiExtension,
  createOutlitPiTool,
  type OutlitPiToolDefinition,
  type PiToolName,
  type PublicToolName,
  piToolNames,
} from "../src/index.js"

function createPiMock() {
  const registeredTools: OutlitPiToolDefinition[] = []

  return {
    registeredTools,
    registerTool: vi.fn((tool: unknown) => {
      registeredTools.push(tool as OutlitPiToolDefinition)
    }),
  }
}

function withoutRootSchema<T extends Record<string, unknown>>(schema: T): Omit<T, "$schema"> {
  const { $schema: _schema, ...rest } = schema
  return rest
}

describe("createOutlitPiExtension", () => {
  test("defaults tools to the hosted Outlit endpoint", async () => {
    const previousApiUrl = process.env.OUTLIT_API_URL
    delete process.env.OUTLIT_API_URL

    try {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
      const pi = createPiMock()

      createOutlitPiExtension({
        apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
        fetch: fetchMock,
        toolNames: ["outlit_list_customers"],
      })(pi)

      const tool = pi.registeredTools[0]
      if (!tool) {
        throw new Error("Expected one registered tool")
      }

      await tool.execute("call_1", {}, undefined, undefined, undefined as never)

      expect(fetchMock).toHaveBeenCalledWith(
        "https://app.outlit.ai/api/tools/call",
        expect.any(Object),
      )
    } finally {
      if (previousApiUrl === undefined) {
        delete process.env.OUTLIT_API_URL
      } else {
        process.env.OUTLIT_API_URL = previousApiUrl
      }
    }
  })

  test("registers the default customer intelligence tools", () => {
    const pi = createPiMock()

    createOutlitPiExtension({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn(),
    })(pi)

    const registeredNames = pi.registeredTools.map((tool) => tool.name)
    expect(defaultToolNames).toEqual([
      "outlit_list_customers",
      "outlit_list_users",
      "outlit_get_customer",
      "outlit_get_timeline",
      "outlit_list_facts",
      "outlit_get_fact",
      "outlit_get_source",
      "outlit_list_sources",
      "outlit_search_customer_context",
    ])
    expect(registeredNames).toEqual([...defaultToolNames])
  })

  test("rejects retired notification sending", () => {
    expect(() =>
      // @ts-expect-error Notification sending is intentionally absent from the public tool type.
      createOutlitPiTool("outlit_send_notification", {
        apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
        fetch: vi.fn(),
      }),
    ).toThrow("Unknown Outlit public tool")
  })

  test("rejects every Behavior Metric command even when explicitly requested", () => {
    for (const toolName of [
      "outlit_list_behavior_metric_sources",
      "outlit_list_behavior_metric_events",
      "outlit_create_behavior_metric",
    ]) {
      expect(() =>
        createOutlitPiTool(toolName as never, {
          apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
          fetch: vi.fn(),
        }),
      ).toThrow("Tool is not available in @outlit/pi")
    }
  })

  test("exposes only Pi-supported tools from the Pi package", () => {
    expect(allPublicToolNames).toEqual(piToolNames)
    expect(allPublicToolNames).toContain("outlit_get_customer_relationship")
    expect(allPublicToolNames).toContain("outlit_list_attention_items")
    expect(allPublicToolNames).toContain("outlit_get_attention_item")
    expect(allPublicToolNames).not.toContain("outlit_list_behavior_metric_sources")
    expect(allPublicToolNames).not.toContain("outlit_list_behavior_metric_events")
    expect(allPublicToolNames).not.toContain("outlit_create_behavior_metric")
  })

  test("preserves PublicToolName as a compatibility alias", () => {
    const legacyToolName: PublicToolName = "outlit_list_customers"
    const currentToolName: PiToolName = legacyToolName

    expect(currentToolName).toBe("outlit_list_customers")
  })

  test("deduplicates custom tool names before registration", () => {
    const pi = createPiMock()

    createOutlitPiExtension({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn(),
      toolNames: ["outlit_list_customers", "outlit_list_customers", "outlit_get_customer"],
    })(pi)

    expect(pi.registeredTools.map((tool) => tool.name)).toEqual([
      "outlit_list_customers",
      "outlit_get_customer",
    ])
  })

  test("executes registered tools through the public Outlit tool client", async () => {
    const apiResult = { items: [{ id: "cust_123" }] }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(apiResult), { status: 200 }))
    const pi = createPiMock()

    createOutlitPiExtension({
      apiKey: " ok_abcdefghijklmnopqrstuvwxyz123456 ",
      baseUrl: "https://example.outlit.test",
      fetch: fetchMock,
      toolNames: ["outlit_list_customers"],
    })(pi)

    const tool = pi.registeredTools[0]
    if (!tool) {
      throw new Error("Expected one registered tool")
    }

    expect(tool.name).toBe("outlit_list_customers")
    expect(tool.label).toBe("Outlit List Customers")
    const contract = getPublicToolContract("outlit_list_customers")

    expect(tool.description).toBe(contract.description)
    expect(tool.parameters).toEqual(withoutRootSchema(contract.inputSchema))

    const result = await tool.execute(
      "call_1",
      { limit: 10 },
      undefined,
      undefined,
      undefined as never,
    )

    expect(fetchMock).toHaveBeenCalledWith("https://example.outlit.test/api/tools/call", {
      method: "POST",
      headers: {
        Authorization: "Bearer ok_abcdefghijklmnopqrstuvwxyz123456",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "outlit_list_customers",
        input: { limit: 10 },
      }),
    })
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(apiResult, null, 2) }],
      details: {
        toolName: "outlit_list_customers",
        result: apiResult,
      },
    })
  })

  test("registers Pi-compatible parameters without root JSON Schema metadata", () => {
    const tool = createOutlitPiTool("outlit_list_customers", {
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn(),
    })

    expect(tool.parameters).not.toHaveProperty("$schema")
  })

  test("requires an Outlit API key when a tool is executed", async () => {
    const previousApiKey = process.env.OUTLIT_API_KEY
    delete process.env.OUTLIT_API_KEY

    try {
      const pi = createPiMock()

      createOutlitPiExtension({
        fetch: vi.fn(),
        toolNames: ["outlit_list_customers"],
      })(pi)

      const tool = pi.registeredTools[0]
      if (!tool) {
        throw new Error("Expected one registered tool")
      }

      await expect(
        tool.execute("call_1", {}, undefined, undefined, undefined as never),
      ).rejects.toThrow("OUTLIT_API_KEY is required to use @outlit/pi tools")
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.OUTLIT_API_KEY
      } else {
        process.env.OUTLIT_API_KEY = previousApiKey
      }
    }
  })

  test("rejects malformed tool input", async () => {
    const pi = createPiMock()

    createOutlitPiExtension({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn(),
      toolNames: ["outlit_list_customers"],
    })(pi)

    const tool = pi.registeredTools[0]
    if (!tool) {
      throw new Error("Expected one registered tool")
    }

    await expect(
      tool.execute("call_1", "limit=10", undefined, undefined, undefined as never),
    ).rejects.toThrow("Outlit Pi tool input must be an object")
    await expect(
      tool.execute("call_1", [], undefined, undefined, undefined as never),
    ).rejects.toThrow("Outlit Pi tool input must be an object")
    await expect(
      tool.execute("call_1", null, undefined, undefined, undefined as never),
    ).rejects.toThrow("Outlit Pi tool input must be an object")
  })
})
