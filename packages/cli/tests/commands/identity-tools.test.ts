import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { runCommand } from "citty"
import { mockExitThrow, setNonInteractive, TEST_API_KEY, useTempEnv } from "../helpers"

const calls: Array<{ tool: string; params: unknown }> = []
mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: async (tool: string, params: unknown) => {
      calls.push({ tool, params })
      if (tool === "outlit_reject_merge_suggestion") {
        return { suggestion: { id: "proposal_1", status: "rejected" } }
      }
      return { operation: { id: "operation_1", status: "queued" } }
    },
  }),
}))

async function command(name: string) {
  if (name === "list" || name === "reject") {
    const { default: root } = await import("../../src/commands/merge-suggestions/index")
    return { root, prefix: [name] }
  }
  if (name === "identity") {
    const { default: root } = await import("../../src/commands/identity/index")
    return { root, prefix: ["get"] }
  }
  if (name === "merge-status") {
    const { default: root } = await import("../../src/commands/merges/index")
    return { root, prefix: ["get"] }
  }
  const { default: root } = await import("../../src/commands/customers/index")
  return { root, prefix: [name] }
}

describe("identity CLI tools", () => {
  useTempEnv("identity-tools")
  beforeEach(() => {
    calls.length = 0
    setNonInteractive()
  })

  test.each([
    ["identity", ["customer_1"], "outlit_get_identity", { customer: "customer_1" }],
    [
      "identity",
      ["customer_1", "--include", "links"],
      "outlit_get_identity",
      { customer: "customer_1", include: ["links"] },
    ],
    [
      "list",
      [
        "--customer",
        "customer_1",
        "--suggestion-id",
        "proposal_1",
        "--cursor",
        "page_2",
        "--limit",
        "7",
        "--status",
        "rejected",
        "--confidence",
        "MEDIUM",
        "--include",
        "impact,scope",
      ],
      "outlit_list_merge_suggestions",
      {
        customer: "customer_1",
        cursor: "page_2",
        limit: 7,
        include: ["impact", "scope"],
        filters: { id: "proposal_1", status: "rejected", confidence: "medium" },
      },
    ],
    [
      "reject",
      ["proposal_1", "--note", "Different companies", "--idempotency-key", "request_9"],
      "outlit_reject_merge_suggestion",
      { id: "proposal_1", note: "Different companies", idempotencyKey: "request_9" },
    ],
    [
      "merge",
      ["survivor_1", "duplicate_1"],
      "outlit_merge_customers",
      { mode: "preview", survivor: "survivor_1", duplicate: "duplicate_1" },
    ],
    [
      "merge",
      [
        "survivor_1",
        "duplicate_1",
        "--mode",
        "execute",
        "--preview-token",
        "reviewed_token",
        "--idempotency-key",
        "request_1",
        "--suggestion-id",
        "proposal_1",
        "--note",
        "Same company verified",
      ],
      "outlit_merge_customers",
      {
        mode: "execute",
        survivor: "survivor_1",
        duplicate: "duplicate_1",
        previewToken: "reviewed_token",
        idempotencyKey: "request_1",
        suggestionId: "proposal_1",
        note: "Same company verified",
      },
    ],
    ["merge-status", ["operation_1"], "outlit_get_merge", { id: "operation_1" }],
  ] as const)("%s sends the exact canonical request", async (name, rawArgs, tool, params) => {
    const cmd = await command(name)
    const write = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await runCommand(cmd.root, { rawArgs: [...cmd.prefix, ...rawArgs, "--json"] })
      expect(calls).toEqual([{ tool, params }])
      expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toEqual(
        tool === "outlit_reject_merge_suggestion"
          ? { suggestion: { id: "proposal_1", status: "rejected" } }
          : { operation: { id: "operation_1", status: "queued" } },
      )
    } finally {
      write.mockRestore()
    }
  })

  test("reject sends a fresh idempotency key when none is passed, so a replay needs --idempotency-key", async () => {
    const cmd = await command("reject")
    const write = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await runCommand(cmd.root, { rawArgs: [...cmd.prefix, "proposal_1", "--json"] })
      await runCommand(cmd.root, { rawArgs: [...cmd.prefix, "proposal_1", "--json"] })
      const ids = calls.map((call) => (call.params as { idempotencyKey: string }).idempotencyKey)
      expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/)
      expect(ids[1]).not.toBe(ids[0])
      expect(calls[0]?.params).toEqual({ id: "proposal_1", idempotencyKey: ids[0] })
    } finally {
      write.mockRestore()
    }
  })

  for (const executionArgs of [
    ["--mode", "execute"],
    ["--mode", "execute", "--preview-token", "reviewed"],
    ["--mode", "execute", "--idempotency-key", "request_1"],
  ]) {
    test(`rejects incomplete execution before transport: ${executionArgs.join(" ")}`, async () => {
      const cmd = await command("merge")
      const write = spyOn(process.stderr, "write").mockImplementation(() => true)
      const exit = mockExitThrow()
      try {
        await expect(
          runCommand(cmd.root, {
            rawArgs: [...cmd.prefix, "survivor_1", "duplicate_1", ...executionArgs, "--json"],
          }),
        ).rejects.toThrow()
        expect(calls).toEqual([])
      } finally {
        exit.mockRestore()
        write.mockRestore()
      }
    })
  }
})
