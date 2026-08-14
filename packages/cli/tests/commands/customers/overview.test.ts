import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { setNonInteractive, TEST_API_KEY, useTempEnv } from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  customer: {
    id: "1",
    name: "Acme Corp",
    domain: "acme.com",
    billingStatus: "PAYING",
  },
  overview: {
    relationshipContext: {
      headline: "Renewal needs attention",
      items: [
        {
          category: "Renewal",
          statement: "Security approval remains open.",
          observedAt: "2026-08-13T00:00:00.000Z",
          sources: [{ label: "Pylon" }],
        },
      ],
    },
    provenance: { kind: "compiled_context", asOf: "2026-08-13T00:00:00.000Z" },
  },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("customers overview", () => {
  useTempEnv("overview-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
  })

  test("gets the bounded customer overview without expanding the compact get command", async () => {
    const { default: overviewCmd } = await import("../../../src/commands/customers/overview")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)

    try {
      await overviewCmd.run!({
        args: { customer: "acme.com", json: true },
      } as Parameters<NonNullable<typeof overviewCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith("outlit_get_customer_overview", {
        customer: "acme.com",
      })

      const written = (writeSpy.mock.calls[0]?.[0] as string) ?? ""
      const result = JSON.parse(written) as { overview: { provenance: { kind: string } } }
      expect(result.overview.provenance.kind).toBe("compiled_context")
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("documents that relationship detail is bounded and separate from the chronological timeline", async () => {
    const { default: overviewCmd } = await import("../../../src/commands/customers/overview")
    const metaSource = overviewCmd.meta
    const meta =
      typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)
    const description = meta?.description ?? ""

    expect(description).toContain("bounded")
    expect(description).toContain("timeline")
    expect(description).toContain("Exact customer name")
    expect(description).not.toContain("partial match")
    expect(description).not.toContain("--include")
  })

  test("documents the public relationship-context field names accurately", () => {
    const docs = readFileSync(
      resolve(import.meta.dirname, "../../../../../docs/cli/commands.mdx"),
      "utf8",
    )

    expect(docs).toContain('"relationshipContext"')
    expect(docs).toContain('"observedAt": "2026-08-01T10:30:00.000Z"')
    expect(docs).not.toContain('"truths"')
    expect(docs).not.toContain('"pivotalMoments"')
  })
})
