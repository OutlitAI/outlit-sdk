import { beforeEach, describe, expect, mock, test } from "bun:test"
import { runCommand } from "citty"
import {
  captureStdout,
  runExpectingError,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const calls: Array<{ tool: string; params: Record<string, unknown> }> = []
const mockCallTool = mock(async (tool: string, params: Record<string, unknown>) => {
  calls.push({ tool, params })
  return { ok: true }
})

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

async function group(name: string) {
  return (await import(`../../src/commands/${name}/index`)).default
}

async function invoke(name: string, rawArgs: string[]) {
  const root = await group(name)
  await captureStdout(async () => {
    await runCommand(root, { rawArgs: [...rawArgs, "--json"] })
  })
}

describe("v2 commands", () => {
  useTempEnv("v2-commands")
  beforeEach(() => {
    setNonInteractive()
    calls.length = 0
    mockCallTool.mockClear()
  })

  test("customer-fields list sends source, search and paging", async () => {
    await invoke("customer-fields", [
      "list",
      "--source",
      "HubSpot",
      "--search",
      " health ",
      "--limit",
      "10",
      "--cursor",
      "c2",
    ])

    expect(calls).toEqual([
      {
        tool: "outlit_list_customer_fields",
        params: { source: "hubspot", search: "health", limit: 10, cursor: "c2" },
      },
    ])
  })

  test("customer-fields list refuses an unknown source before calling Core", async () => {
    const list = (await import("../../src/commands/customer-fields/list")).default

    await runExpectingError(
      () => list.run!({ args: { source: "zendesk", json: true } } as never),
      "invalid_input",
    )
    expect(calls).toEqual([])
  })

  test("tasks list sends the section, customer and owner", async () => {
    await invoke("tasks", ["list", "--section", "open", "--customer", "acme.com", "--owner", "m1"])

    expect(calls).toEqual([
      {
        tool: "outlit_list_tasks",
        params: { section: "open", customer: "acme.com", filters: { owner: "m1" }, limit: 25 },
      },
    ])
  })

  test("tasks list refuses an unknown section", async () => {
    const list = (await import("../../src/commands/tasks/list")).default

    await runExpectingError(
      () => list.run!({ args: { section: "later", json: true } } as never),
      "invalid_input",
    )
  })

  test("tasks get takes the id as a positional and a lowercase include list", async () => {
    await invoke("tasks", ["get", "task_1", "--include", "Source,DRAFT"])

    expect(calls).toEqual([
      { tool: "outlit_get_task", params: { id: "task_1", include: ["source", "draft"] } },
    ])
  })

  test("tasks get refuses an unknown include value", async () => {
    const get = (await import("../../src/commands/tasks/get")).default

    await runExpectingError(
      () => get.run!({ args: { id: "t", include: "everything", json: true } } as never),
      "invalid_input",
    )
  })

  test("tasks act sends id, action, until and a generated request id", async () => {
    await invoke("tasks", ["act", "task_1", "snooze", "--until", "2026-11-14T09:00:00Z"])
    await invoke("tasks", ["act", "task_1", "wont_do", "--reason", "not_needed"])

    expect(calls[0]).toEqual({
      tool: "outlit_act_on_task",
      params: {
        id: "task_1",
        action: "snooze",
        until: "2026-11-14T09:00:00Z",
        idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    })
    expect(calls[1]?.params).toMatchObject({ action: "wont_do", reason: "not_needed" })
    expect(calls[1]?.params.idempotencyKey).not.toBe(calls[0]?.params.idempotencyKey)
  })

  test("tasks act keeps a given request id so a retry returns the first result", async () => {
    await invoke("tasks", ["act", "task_1", "done", "--idempotency-key", "req_7"])
    await invoke("tasks", ["act", "task_1", "done", "--idempotency-key", "req_7"])

    expect(calls.map((call) => call.params.idempotencyKey)).toEqual(["req_7", "req_7"])
  })

  test("tasks act refuses an unknown action or reason before calling Core", async () => {
    const act = (await import("../../src/commands/tasks/act")).default

    await runExpectingError(
      () => act.run!({ args: { id: "t", action: "explode", json: true } } as never),
      "invalid_input",
    )
    await runExpectingError(
      () =>
        act.run!({ args: { id: "t", action: "wont_do", reason: "bored", json: true } } as never),
      "invalid_input",
    )
    expect(calls).toEqual([])
  })

  test("tasks undo takes the undo token as a positional", async () => {
    await invoke("tasks", ["undo", "undo_token_1", "--idempotency-key", "req_9"])

    expect(calls).toEqual([
      {
        tool: "outlit_undo_task_action",
        params: { undoToken: "undo_token_1", idempotencyKey: "req_9" },
      },
    ])
  })

  test("setup-sessions get sends the session id as id", async () => {
    await invoke("setup-sessions", ["get", "5b0e2f3a-6c1d-4e8a-9a3b-0c9d8e7f6a5b"])

    expect(calls).toEqual([
      {
        tool: "outlit_get_setup_session",
        params: { id: "5b0e2f3a-6c1d-4e8a-9a3b-0c9d8e7f6a5b" },
      },
    ])
  })

  test("facts get takes the fact id as a positional", async () => {
    await invoke("facts", ["get", "fact_1"])

    expect(calls).toEqual([{ tool: "outlit_get_fact", params: { id: "fact_1" } }])
  })

  test("sources get takes the type and id as positionals", async () => {
    await invoke("sources", ["get", "call", "call_1", "--limit", "5"])

    expect(calls).toEqual([
      {
        tool: "outlit_get_source",
        params: { source: { type: "call", id: "call_1" }, limit: 5 },
      },
    ])
  })

  test("timeline get sends product detail and metadata", async () => {
    await invoke("timeline", ["get", "acme.com", "--product-detail", "raw", "--include-metadata"])

    expect(calls[0]?.tool).toBe("outlit_get_timeline")
    expect(calls[0]?.params).toMatchObject({
      customer: "acme.com",
      productDetail: "raw",
      includeMetadata: true,
    })
  })

  test("features create sends the tool's input names", async () => {
    await invoke("features", [
      "create",
      "--source-key",
      "metric_source_v1_0123456789abcdef0123456789abcdef",
      "--event-name",
      "report_exported",
      "--feature-key",
      "reports_exported",
      "--name",
      "Reports exported",
      "--idempotency-key",
      "req_1",
    ])

    expect(calls[0]).toEqual({
      tool: "outlit_create_feature",
      params: {
        sourceKey: "metric_source_v1_0123456789abcdef0123456789abcdef",
        eventName: "report_exported",
        featureKey: "reports_exported",
        name: "Reports exported",
        propertyFilters: [],
        idempotencyKey: "req_1",
      },
    })
  })
})

describe("two-step write flags", () => {
  useTempEnv("v2-write-mode")
  beforeEach(() => {
    setNonInteractive()
    calls.length = 0
    mockCallTool.mockClear()
  })

  test("set-owner --mode preview sends exactly one preview call", async () => {
    await invoke("customers", [
      "set-owner",
      "acme.com",
      "--member",
      "u1",
      "--mode",
      "preview",
      "--idempotency-key",
      "req_1",
    ])

    expect(calls).toEqual([
      {
        tool: "outlit_set_customer_owner",
        params: { customer: "acme.com", member: "u1", mode: "preview", idempotencyKey: "req_1" },
      },
    ])
  })

  test("set-owner --mode execute sends the reviewed token in one call", async () => {
    await invoke("customers", [
      "set-owner",
      "acme.com",
      "--member",
      "u1",
      "--mode",
      "execute",
      "--preview-token",
      "tok",
      "--idempotency-key",
      "req_2",
    ])

    expect(calls).toEqual([
      {
        tool: "outlit_set_customer_owner",
        params: {
          customer: "acme.com",
          member: "u1",
          mode: "execute",
          previewToken: "tok",
          idempotencyKey: "req_2",
        },
      },
    ])
  })

  test("--mode execute without a token is refused before any call", async () => {
    const setOwner = (await import("../../src/commands/customers/set-owner")).default

    await runExpectingError(
      () =>
        setOwner.run!({
          args: { customer: "acme.com", member: "u1", mode: "execute", json: true },
        } as never),
      "missing_input",
    )
    expect(calls).toEqual([])
  })

  test("a preview token without --mode execute is refused", async () => {
    const setOwner = (await import("../../src/commands/customers/set-owner")).default

    await runExpectingError(
      () =>
        setOwner.run!({
          args: { customer: "acme.com", member: "u1", "preview-token": "tok", json: true },
        } as never),
      "invalid_input",
    )
  })

  test("set-owner and set-access reverse an earlier change with --undo-token", async () => {
    await invoke("customers", ["set-owner", "--undo-token", "undo_1", "--idempotency-key", "r1"])
    await invoke("customers", ["set-access", "--undo-token", "undo_2", "--idempotency-key", "r2"])

    expect(calls).toEqual([
      { tool: "outlit_set_customer_owner", params: { undoToken: "undo_1", idempotencyKey: "r1" } },
      { tool: "outlit_set_customer_access", params: { undoToken: "undo_2", idempotencyKey: "r2" } },
    ])
  })

  test("set-access sends --role none, and takes only --mode execute", async () => {
    await invoke("customers", [
      "set-access",
      "acme.com",
      "--member",
      "u1",
      "--role",
      "none",
      "--mode",
      "execute",
      "--preview-token",
      "tok",
      "--idempotency-key",
      "r1",
    ])
    expect(calls[0]?.params).toEqual({
      customer: "acme.com",
      member: "u1",
      role: "none",
      mode: "execute",
      previewToken: "tok",
      idempotencyKey: "r1",
    })

    const setAccess = (await import("../../src/commands/customers/set-access")).default
    calls.length = 0
    await runExpectingError(
      () =>
        setAccess.run!({
          args: { customer: "acme.com", member: "u1", role: "viewer", mode: "preview", json: true },
        } as never),
      "invalid_input",
    )
    expect(calls).toEqual([])
  })

  test("destinations archive and features archive take the same flags", async () => {
    await invoke("destinations", ["archive", "d1", "--mode", "preview", "--idempotency-key", "r1"])
    await invoke("features", [
      "archive",
      "f1",
      "--revision",
      "rev",
      "--mode",
      "execute",
      "--preview-token",
      "tok",
      "--idempotency-key",
      "r2",
    ])

    expect(calls).toEqual([
      {
        tool: "outlit_archive_destination",
        params: { id: "d1", mode: "preview", idempotencyKey: "r1" },
      },
      {
        tool: "outlit_archive_feature",
        params: {
          id: "f1",
          revision: "rev",
          mode: "execute",
          previewToken: "tok",
          idempotencyKey: "r2",
        },
      },
    ])
  })
})
