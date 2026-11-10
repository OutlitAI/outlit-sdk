import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const attentionItem = {
  id: "11111111-1111-4111-8111-111111111111",
  customer: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Acme",
    domain: "acme.test",
  },
  owner: { id: "user_1", name: "Ada Lovelace", email: "ada@example.test" },
  title: "Reporting usage collapsed",
  priority: "high",
  status: "open",
  openedAt: "2026-08-01T00:00:00.000Z",
  resolvedAt: null,
  reopenedAt: null,
  materialUpdateAt: null,
  evidenceCount: 1,
  importance: {
    arrAtAssessment: { amount: 1_200_000, currency: "USD", decimals: 2, formatted: "$12,000.00" },
    shareWithinCurrency: 0.12,
    percentileWithinCurrency: 95,
    segments: ["Enterprise"],
  },
  preparedAction: null,
  tasks: { instruction: "List this customer's open tasks.", tool: "outlit_list_tasks" },
  outlit: { createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-02T00:00:00.000Z" },
} as const

const mockCallTool = mock(async (toolName: string) => {
  if (toolName === "outlit_get_case") {
    return {
      ...attentionItem,
      assessment: {
        whatChanged: "Reporting exports fell.",
        whyItMatters: "Reporting is a primary workflow.",
        uncertainty: null,
        priorityReason: "Renewal is close.",
        latestUpdate: null,
      },
      timeline: [],
      evidence: [],
    }
  }

  return { items: [attentionItem], page: { hasMore: false, total: 1, nextCursor: null } }
})

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("attention commands", () => {
  useTempEnv("attention-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("lists Attention with Core defaults and preserves Core-owned ARR at assessment", async () => {
    const { default: listCommand } = await import("../../src/commands/attention/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCommand.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCommand.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_list_cases", {})
      const output = JSON.parse((writeSpy.mock.calls[0]?.[0] as string) ?? "{}")
      expect(output.items[0].importance).toEqual(attentionItem.importance)
      expect(output.page).toEqual({ hasMore: false, total: 1, nextCursor: null })
      expect(JSON.stringify(output)).not.toContain("mrrCents")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("maps supported Attention list filters and the opaque cursor directly to the public tool", async () => {
    const { default: listCommand } = await import("../../src/commands/attention/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCommand.run!({
        args: {
          status: "resolved",
          "customer-id": "22222222-2222-4222-8222-222222222222",
          limit: "50",
          cursor: "opaque-cursor",
          json: true,
        },
      } as Parameters<NonNullable<typeof listCommand.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_list_cases", {
        filters: { status: "resolved" },
        customer: "22222222-2222-4222-8222-222222222222",
        limit: 50,
        cursor: "opaque-cursor",
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("does not register a removed Attention priority flag", async () => {
    const { default: listCommand } = await import("../../src/commands/attention/list")

    expect(listCommand.args).not.toHaveProperty("priority")
  })

  test("gets one Attention item by its exact ID", async () => {
    const { default: getCommand } = await import("../../src/commands/attention/get")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await getCommand.run!({
        args: { id: attentionItem.id, json: true },
      } as Parameters<NonNullable<typeof getCommand.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_case", {
        id: attentionItem.id,
      })
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("rejects invalid list filters before an API call", async () => {
    const { default: listCommand } = await import("../../src/commands/attention/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    let thrown: unknown
    let stderrWritten = ""
    try {
      await listCommand.run!({
        args: { status: "closed", json: true },
      } as Parameters<NonNullable<typeof listCommand.run>>[0])
    } catch (error) {
      thrown = error
      stderrWritten = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrWritten, "invalid_input")
    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("registers only list and get under the top-level Attention resource", async () => {
    const { default: attentionCommand } = await import("../../src/commands/attention")

    expect(Object.keys(attentionCommand.subCommands ?? {})).toEqual(["list", "get"])
  })

  test("documents the bounded read-only surface without email bodies or Responsibilities", () => {
    const docs = readFileSync(
      resolve(import.meta.dirname, "../../../../docs/cli/commands.mdx"),
      "utf8",
    )

    expect(docs).toContain("outlit attention list")
    expect(docs).toContain("outlit attention get <id>")
    expect(docs).toContain("arrAtAssessment")
    expect(docs).toContain("shareWithinCurrency")
    expect(docs).toContain("preparedAction")
    expect(docs).not.toContain("outlit responsibilities")
    expect(docs).not.toContain("prepared email body")
  })
})
