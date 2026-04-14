import { defaultAgentToolNames, getCustomerToolContract } from "@outlit/tools"
import { describe, expect, test, vi } from "vitest"

import { createOutlitPiExtension, type OutlitPiToolDefinition } from "../src/index.js"

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
  test("registers the default customer intelligence tools", () => {
    const pi = createPiMock()

    createOutlitPiExtension({
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      fetch: vi.fn(),
    })(pi)

    const registeredNames = pi.registeredTools.map((tool) => tool.name)
    expect(registeredNames).toEqual([...defaultAgentToolNames])
    expect(registeredNames).not.toContain("outlit_query")
    expect(registeredNames).not.toContain("outlit_schema")
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
})
