import { describe, expect, spyOn, test } from "bun:test"
import { expectErrorExit, mockExitThrow, setNonInteractive } from "../helpers"

setNonInteractive()

function captureCompletions(shell: string): Promise<string> {
  return (async () => {
    const { default: completionsCmd } = await import("../../src/commands/completions")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await completionsCmd.run!({
        args: { shell },
      } as Parameters<NonNullable<typeof completionsCmd.run>>[0])
      return (writeSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      writeSpy.mockRestore()
    }
  })()
}

describe("completions command", () => {
  test("bash — top-level commands", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain("complete -F _outlit_completions outlit")
    expect(out).toContain("facts")
    expect(out).toContain("sources")
  })

  test("bash — subcommand dispatch", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain('facts) COMPREPLY=($(compgen -W "list get')
    expect(out).toContain('sources) COMPREPLY=($(compgen -W "get')
    expect(out).toContain('customers) COMPREPLY=($(compgen -W "list get timeline')
    expect(out).toContain("COMP_CWORD -eq 2")
    expect(out).toContain("signup login logout status whoami")
    expect(out).toContain("claude-code codex gemini droid opencode pi openclaw skills --json --yes")
  })

  test("bash — flag completions for updated commands", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain(
      'search) COMPREPLY=($(compgen -W "--api-key --json --customer --top-k --after --before --source-types"',
    )
    expect(out).toContain(
      'facts.list) COMPREPLY=($(compgen -W "--api-key --json --limit --cursor --status --source-types --fact-types --fact-categories --after --before"',
    )
    expect(out).toContain(
      'facts.get) COMPREPLY=($(compgen -W "--api-key --json --fact-id --include"',
    )
    expect(out).toContain(
      'sources.get) COMPREPLY=($(compgen -W "--api-key --json --source-type --source-id"',
    )
  })

  // ── Zsh ─────────────────────────────────────────────────────────────────

  test("zsh — top-level commands", async () => {
    const out = await captureCompletions("zsh")
    expect(out).toContain("#compdef outlit")
    expect(out).toContain("CURRENT == 2")
    expect(out).toContain("'auth:Manage authentication'")
  })

  test("zsh — subcommand dispatch", async () => {
    const out = await captureCompletions("zsh")
    expect(out).toContain("CURRENT == 3")
    expect(out).toContain("'list:List and filter customers'")
    expect(out).toContain("'signup:Create an Outlit account'")
    expect(out).toContain("'codex:Install the Outlit skill for Codex'")
    expect(out).toContain("'opencode:Install the Outlit skill for OpenCode'")
  })
  test("zsh — flag completions with descriptions", async () => {
    const out = await captureCompletions("zsh")
    expect(out).toContain("'facts:Get customer facts'")
    expect(out).toContain("'sources:Get a concrete source by type and id'")
    expect(out).toContain("'--status:Filter by fact status'")
    expect(out).toContain("'--fact-id:Fact ID to fetch'")
    expect(out).toContain("'--source-type:Source type'")
    expect(out).toContain("facts.list)")
    expect(out).toContain("sources.get)")
  })

  test("fish — flag completions with nested commands", async () => {
    const out = await captureCompletions("fish")
    expect(out).toContain("-n '__outlit_using_cmd search' -l source-types")
    expect(out).toContain("-n '__outlit_using_cmd facts list' -l status")
    expect(out).toContain("-n '__outlit_using_cmd facts get' -l fact-id")
    expect(out).toContain("-n '__outlit_using_cmd sources get' -l source-type")
    expect(out).toContain("-n '__outlit_using_cmd customers list' -l billing-status")
    expect(out).toContain("-n '__outlit_using_cmd customers list' -l trait")
    expect(out).toContain("-n '__outlit_using_cmd auth login' -l key")
    expect(out).toContain("-n '__outlit_using_cmd users list' -l journey-stage")
    expect(out).toContain("-n '__outlit_using_cmd users list' -l trait")
    expect(out).toContain("-n '__outlit_using_cmd setup' -l yes")
    expect(out).toContain("-n '__outlit_using_cmd setup claude-code' -l json")
    expect(out).toContain("-n '__outlit_using_cmd setup opencode' -l json")
    expect(out).toContain("-n '__outlit_using_cmd setup openclaw' -l json")
    expect(out).not.toContain("-n '__outlit_using_cmd setup claude-code' -l api-key")
  })

  test("unknown shell — exits 1", async () => {
    const { default: completionsCmd } = await import("../../src/commands/completions")
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()

    let thrown: unknown
    let stderrOutput = ""
    try {
      await completionsCmd.run!({
        args: { shell: "powershell" },
      } as Parameters<NonNullable<typeof completionsCmd.run>>[0])
    } catch (e) {
      thrown = e
      stderrOutput = (stderrSpy.mock.calls[0]?.[0] as string) ?? ""
    } finally {
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrOutput, "unknown_shell")
  })
})
