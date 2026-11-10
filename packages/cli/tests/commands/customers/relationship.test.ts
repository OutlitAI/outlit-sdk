import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  customer: {
    id: "1",
    name: "Acme Corp",
    domain: "acme.com",
  },
  relationship: {
    status: "available",
    asOf: "2026-08-13T00:00:00.000Z",
    data: {
      summary: "Renewal needs attention",
      items: [
        {
          category: "Renewal",
          statement: "Security approval remains open.",
          observedAt: "2026-08-13T00:00:00.000Z",
          sourceLabels: ["Pylon"],
        },
      ],
      updatedAt: "2026-08-13T00:00:00.000Z",
    },
  },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("customers relationship (previous command)", () => {
  useTempEnv("relationship-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("reads the relationship section of get_customer", async () => {
    const { default: relationshipCmd } = await import(
      "../../../src/commands/customers/relationship"
    )
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await relationshipCmd.run!({
        args: { customer: "acme.com", json: true },
      } as Parameters<NonNullable<typeof relationshipCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_customer", {
        customer: "acme.com",
        include: ["relationship"],
      })

      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as {
        relationship: { status: string; data: { updatedAt: string | null } }
      }
      expect(result.relationship.status).toBe("available")
      expect(result.relationship.data.updatedAt).toBe("2026-08-13T00:00:00.000Z")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("is hidden from help, which advertises customers get --include relationship", async () => {
    const { default: relationshipCmd } = await import(
      "../../../src/commands/customers/relationship"
    )
    const meta =
      typeof relationshipCmd.meta === "function"
        ? await relationshipCmd.meta()
        : await relationshipCmd.meta

    expect(meta?.hidden).toBe(true)
    expect(meta?.description).toContain("customers get <customer> --include relationship")
  })

  test("documents the public relationship field names accurately", () => {
    const docs = readFileSync(
      resolve(import.meta.dirname, "../../../../../docs/cli/commands.mdx"),
      "utf8",
    )

    expect(docs).toContain('"relationship"')
    expect(docs).toContain('"observedAt": "2026-08-01T10:30:00.000Z"')
    expect(docs).toContain('"sourceLabels"')
    expect(docs).toContain('"updatedAt"')
    expect(docs).not.toContain('"provenance"')
  })
})
