import { defaultAgentToolNames, getCustomerToolContract } from "@outlit/tools"
import { describe, expect, test, vi } from "vitest"

import {
  actionToolNames,
  createOutlitPiExtension,
  createOutlitPiTool,
  type OutlitPiToolDefinition,
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
    expect(registeredNames).toEqual([...defaultAgentToolNames])
    expect(registeredNames).toContain("outlit_send_notification")
    expect(registeredNames).not.toContain("outlit_query")
    expect(registeredNames).not.toContain("outlit_schema")
  })

  test("exports the action tool names from Pi", () => {
    expect(actionToolNames).toEqual(["outlit_send_notification"])
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
    expect(tool.description).toBe(getCustomerToolContract("outlit_list_customers").description)
    expect(tool.parameters).toEqual(getCustomerToolContract("outlit_list_customers").inputSchema)

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

  test("exposes the notification tool contract through Pi", () => {
    const tool = createOutlitPiTool("outlit_send_notification", {
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn(),
    })
    const contract = getCustomerToolContract("outlit_send_notification")

    expect(tool.name).toBe("outlit_send_notification")
    expect(tool.label).toBe("Outlit Send Notification")
    expect(tool.description).toBe(contract.description)
    expect(tool.parameters).toEqual(contract.inputSchema)

    if (
      tool.parameters &&
      typeof tool.parameters === "object" &&
      "required" in tool.parameters &&
      Array.isArray(tool.parameters.required)
    ) {
      expect(tool.parameters.required).toEqual(["title", "payload"])
    } else {
      throw new Error("Expected notification tool parameters to expose required fields")
    }
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
