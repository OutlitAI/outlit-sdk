import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  ExitError,
  mockExitThrow,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
} from "../helpers"

const promptCancelled = Symbol("prompt-cancelled")
const mockConfirm = mock(async (): Promise<unknown> => true)

// Same shape as the other suites that mock the prompts: mock.module() is process-wide.
mock.module("@clack/prompts", () => ({
  password: mock(async () => "synthetic-secret"),
  text: mock(async () => "visible-value"),
  select: mock(async () => "us"),
  confirm: mockConfirm,
  isCancel: (value: unknown) => value === promptCancelled,
  log: { info: () => {}, warn: () => {} },
}))

const preview = { done: false, token: "token_1", what: "archive the thing" }
const finished = { done: true }

const mockCallTool = mock(async (_toolName: string, _params: unknown): Promise<unknown> => preview)
const client = { key: TEST_API_KEY, baseUrl: "https://app.outlit.ai", callTool: mockCallTool }

function options(overrides: Partial<{ yes: boolean; json: boolean }> = {}) {
  return {
    input: { id: "x" },
    json: false,
    yes: false,
    spinnerMessage: "Working...",
    pending: (result: unknown) => {
      const data = result as typeof preview
      return data.done ? null : { token: data.token, lines: [`Would ${data.what}.`] }
    },
    confirmed: (token: string) => ({ id: "x", previewToken: token }),
    question: "Go ahead?",
    unchanged: "Nothing was changed",
    ...overrides,
  }
}

async function run(opts: ReturnType<typeof options>) {
  const { runConfirmedWrite } = await import("../../src/lib/confirm")
  const stdout = spyOn(process.stdout, "write").mockImplementation(() => true)
  const stderr = spyOn(process.stderr, "write").mockImplementation(() => true)
  const exit = mockExitThrow()
  const consoleError = spyOn(console, "error").mockImplementation(() => {})
  let thrown: unknown
  try {
    await runConfirmedWrite(client as never, "outlit_archive_destination", opts as never)
  } catch (error) {
    thrown = error
  }
  const out = stdout.mock.calls.map((call) => call[0] as string).join("")
  const err = stderr.mock.calls.map((call) => call[0] as string).join("")
  stdout.mockRestore()
  stderr.mockRestore()
  exit.mockRestore()
  consoleError.mockRestore()
  return { thrown, out, err }
}

describe("runConfirmedWrite", () => {
  beforeEach(() => {
    mockCallTool.mockClear()
    mockConfirm.mockClear()
    mockCallTool.mockImplementation(async () => preview)
    setNonInteractive()
  })

  test("returns a result that needed no confirmation without a second call", async () => {
    mockCallTool.mockImplementationOnce(async () => finished)
    const { thrown, out } = await run(options({ json: true }))

    expect(thrown).toBeUndefined()
    expect(JSON.parse(out)).toEqual(finished)
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("asks in a terminal, shows what would change, and confirms with the token on yes", async () => {
    setInteractive()
    mockCallTool.mockImplementationOnce(async () => preview)
    mockCallTool.mockImplementationOnce(async () => finished)
    mockConfirm.mockResolvedValueOnce(true)
    const { thrown, out, err } = await run(options())

    expect(thrown).toBeUndefined()
    expect(err).toContain("Would archive the thing.")
    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_archive_destination", {
      id: "x",
      previewToken: "token_1",
    })
    expect(JSON.parse(out)).toEqual(finished)
  })

  test("changes nothing when the answer is no", async () => {
    setInteractive()
    mockConfirm.mockResolvedValueOnce(false)
    const { thrown } = await run(options())

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("changes nothing when the prompt is cancelled", async () => {
    setInteractive()
    mockConfirm.mockResolvedValueOnce(promptCancelled)
    const { thrown } = await run(options())

    expect(thrown).toBeInstanceOf(ExitError)
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("--yes confirms in a terminal without asking", async () => {
    setInteractive()
    mockCallTool.mockImplementationOnce(async () => preview)
    mockCallTool.mockImplementationOnce(async () => finished)
    const { thrown } = await run(options({ yes: true }))

    expect(thrown).toBeUndefined()
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockCallTool).toHaveBeenCalledTimes(2)
  })

  test("outside a terminal without --yes prints the preview and exits 1 with confirmation_required", async () => {
    const { thrown, out, err } = await run(options({ json: true }))

    expect(thrown).toBeInstanceOf(ExitError)
    expect((thrown as ExitError).code).toBe(1)
    expect(JSON.parse(out)).toEqual(preview)
    expect(JSON.parse(err)).toMatchObject({ code: "confirmation_required" })
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })
})
