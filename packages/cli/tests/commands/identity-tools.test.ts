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
      return { operationId: "operation_1", status: "queued" }
    },
  }),
}))

async function command(name: string) {
  if (name === "list" || name === "reject") {
    const { default: root } = await import("../../src/commands/identity/index")
    return { root, prefix: ["suggestions", name] }
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
    ["identity", ["customer_1"], "outlit_get_customer_identity", { customerId: "customer_1" }],
    [
      "list",
      [
        "--customer-id",
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
      ],
      "outlit_list_identity_merge_suggestions",
      {
        customerId: "customer_1",
        suggestionId: "proposal_1",
        cursor: "page_2",
        limit: 7,
        status: "rejected",
        confidence: "MEDIUM",
      },
    ],
    [
      "reject",
      ["proposal_1", "--review-notes", "Different companies"],
      "outlit_reject_identity_merge_suggestion",
      { suggestionId: "proposal_1", reviewNotes: "Different companies" },
    ],
    [
      "merge",
      ["survivor_1", "duplicate_1"],
      "outlit_merge_customers",
      { survivingCustomerId: "survivor_1", duplicateCustomerId: "duplicate_1", dryRun: true },
    ],
    [
      "merge",
      [
        "survivor_1",
        "duplicate_1",
        "--execute",
        "--preview-token",
        "reviewed_token",
        "--request-id",
        "request_1",
        "--suggestion-id",
        "proposal_1",
        "--review-notes",
        "Same company verified",
      ],
      "outlit_merge_customers",
      {
        survivingCustomerId: "survivor_1",
        duplicateCustomerId: "duplicate_1",
        dryRun: false,
        previewToken: "reviewed_token",
        requestId: "request_1",
        suggestionId: "proposal_1",
        reviewNotes: "Same company verified",
      },
    ],
    [
      "merge-status",
      ["operation_1"],
      "outlit_get_customer_merge_status",
      { operationId: "operation_1" },
    ],
  ] as const)("%s sends the exact canonical request", async (name, rawArgs, tool, params) => {
    const cmd = await command(name)
    const write = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await runCommand(cmd.root, { rawArgs: [...cmd.prefix, ...rawArgs, "--json"] })
      expect(calls).toEqual([{ tool, params }])
      expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toEqual({
        operationId: "operation_1",
        status: "queued",
      })
    } finally {
      write.mockRestore()
    }
  })

  for (const executionArgs of [
    ["--execute"],
    ["--execute", "--preview-token", "reviewed"],
    ["--execute", "--request-id", "request_1"],
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
