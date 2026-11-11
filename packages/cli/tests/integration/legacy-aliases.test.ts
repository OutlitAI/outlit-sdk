import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TEST_API_KEY } from "../helpers"

// Runs the real CLI entry point against a local gateway, so the whole path is exercised: the old
// spelling is rewritten, the new command is parsed, and its request reaches the gateway.

const cliEntry = join(import.meta.dir, "..", "..", "src", "cli.ts")
const calls: Array<{ tool: string; input: Record<string, unknown> }> = []
let server: ReturnType<typeof Bun.serve>
let home: string

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "outlit-legacy-e2e-"))
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as { tool: string; input: Record<string, unknown> }
      calls.push({ tool: body.tool, input: body.input })
      return Response.json({ items: [], page: { hasMore: false, nextCursor: null } })
    },
  })
})

afterAll(() => {
  server.stop(true)
  rmSync(home, { recursive: true, force: true })
})

async function run(args: string[]) {
  calls.length = 0
  const proc = Bun.spawn(["bun", cliEntry, ...args, "--json"], {
    env: {
      PATH: process.env.PATH ?? "",
      HOME: home,
      XDG_CONFIG_HOME: home,
      OUTLIT_API_KEY: TEST_API_KEY,
      OUTLIT_API_URL: `http://127.0.0.1:${server.port}`,
      OUTLIT_NO_UPDATE_NOTIFIER: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stderr] = await Promise.all([new Response(proc.stderr).text(), proc.exited])
  return { stderr, calls: [...calls] }
}

const notice = (stderr: string) => stderr.split("\n").filter((line) => line.startsWith("Renamed:"))

describe("old spellings through the real CLI", () => {
  test.each([
    [
      ["customers", "timeline", "acme.com"],
      "outlit_get_timeline",
      "Renamed: use `outlit timeline get <customer>`",
    ],
    [
      ["customers", "credits", "acme.com"],
      "outlit_get_customer",
      "Renamed: use `outlit customers get <customer> --include credits`",
    ],
    [["ws-users", "list"], "outlit_list_members", "Renamed: use `outlit members list`"],
    [["users", "list"], "outlit_list_people", "Renamed: use `outlit people list`"],
    [["sql", "SELECT 1"], "outlit_query", "Renamed: use `outlit query`"],
    [["schema"], "outlit_get_schema", "Renamed: use `outlit schema get`"],
    [
      ["facts", "get", "--fact-id", "f1"],
      "outlit_get_fact",
      "Renamed: use `outlit facts get <fact-id>`",
    ],
    [
      ["sources", "get", "--source-type", "call", "--source-id", "c1"],
      "outlit_get_source",
      "Renamed: use `outlit sources get <type> <id>`",
    ],
    [
      ["destinations", "get", "d1"],
      "outlit_list_destinations",
      "Renamed: use `outlit destinations list --ids <id>`",
    ],
    [
      ["destinations", "disable", "d1"],
      "outlit_update_destination",
      "Renamed: use `outlit destinations update <id> --enabled false`",
    ],
    [
      ["activation", "disable"],
      "outlit_update_settings",
      "Renamed: use `outlit settings update --activation-event none`",
    ],
    [
      ["integrations", "status"],
      "outlit_list_integrations",
      "Renamed: use `outlit integrations list`",
    ],
    [
      ["identity", "suggestions", "list"],
      "outlit_list_merge_suggestions",
      "Renamed: use `outlit merge-suggestions list --customer <customer>`",
    ],
  ])("%j sends %s and warns once", async (args, tool, expectedNotice) => {
    const result = await run(args)

    expect(notice(result.stderr)).toEqual([expectedNotice])
    expect(result.calls.map((call) => call.tool)).toEqual([tool])
  })

  test("--crm-fields is --fields, with one notice", async () => {
    const result = await run([
      "customers",
      "get",
      "acme.com",
      "--include",
      "crm",
      "--crm-fields",
      "hs_lead_status",
    ])

    expect(notice(result.stderr)).toEqual([
      "Renamed: use `outlit customers get <customer> --include crm --fields <key,...>`",
    ])
    expect(result.calls[0]).toEqual({
      tool: "outlit_get_customer",
      input: expect.objectContaining({ include: ["crm"], fields: [{ key: "hs_lead_status" }] }),
    })
  })

  test("a current spelling prints no notice", async () => {
    const result = await run(["timeline", "get", "acme.com"])

    expect(notice(result.stderr)).toEqual([])
    expect(result.calls.map((call) => call.tool)).toEqual(["outlit_get_timeline"])
  })

  test("an old spelling sends the same request as the new one", async () => {
    const old = await run(["facts", "get", "--fact-id", "f1", "--include", "evidence"])
    const current = await run(["facts", "get", "f1", "--include", "evidence"])

    expect(old.calls).toEqual(current.calls)
    expect(current.calls[0]?.input).toEqual({ id: "f1", include: ["evidence"] })
  })

  test("help for an old spelling prints no notice", async () => {
    const result = await run(["ws-users", "list", "--help"])

    expect(notice(result.stderr)).toEqual([])
  })
})
