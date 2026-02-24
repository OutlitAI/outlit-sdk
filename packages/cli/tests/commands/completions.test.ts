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
  // ── Bash ────────────────────────────────────────────────────────────────

  test("bash — top-level commands", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain("compgen")
    expect(out).toContain("complete -F _outlit_completions outlit")
    expect(out).toContain("COMP_CWORD -eq 1")
  })

  test("bash — subcommand dispatch", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain("COMP_CWORD -eq 2")
    expect(out).toContain("signup login logout status whoami")
    expect(out).toContain("list get timeline")
  })

  test("bash — flag completions for leaf commands", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain("facts) COMPREPLY=($(compgen -W \"--api-key --json --limit --cursor --timeframe\"")
    expect(out).toContain("search) COMPREPLY=($(compgen -W \"--api-key --json --customer --top-k --after --before\"")
    expect(out).toContain("sql) COMPREPLY=($(compgen -W \"--api-key --json --query-file --limit\"")
  })

  test("bash — flag completions for subcommands", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain("customers.list) COMPREPLY=($(compgen -W \"--api-key --json --limit --cursor --no-activity-in --has-activity-in --order-by --order-direction --billing-status --mrr-above --mrr-below --search --status --type\"")
    expect(out).toContain("auth.login) COMPREPLY=($(compgen -W \"--json --key\"")
    expect(out).toContain("users.list) COMPREPLY=($(compgen -W \"--api-key --json --limit --cursor --no-activity-in --has-activity-in --order-by --order-direction --journey-stage --customer-id --search\"")
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
  })

  test("zsh — flag completions with descriptions", async () => {
    const out = await captureCompletions("zsh")
    // Leaf command flags
    expect(out).toContain("'--timeframe:Lookback window (7d, 30d, 90d)'")
    // Subcommand flags
    expect(out).toContain("'--billing-status:Filter by billing status'")
    expect(out).toContain("'--journey-stage:Filter by journey stage'")
    expect(out).toContain("'--key:API key to store'")
    // Flag context keying
    expect(out).toContain("customers.list)")
    expect(out).toContain("auth.login)")
  })

  // ── Fish ────────────────────────────────────────────────────────────────

  test("fish — top-level commands", async () => {
    const out = await captureCompletions("fish")
    expect(out).toContain("complete -c outlit")
    expect(out).toContain("__fish_use_subcommand")
  })

  test("fish — subcommands with custom helper", async () => {
    const out = await captureCompletions("fish")
    expect(out).toContain("function __outlit_using_cmd")
    expect(out).toContain("__outlit_using_cmd customers")
    expect(out).toContain("__outlit_using_cmd auth")
  })

  test("fish — flag completions with -l (long)", async () => {
    const out = await captureCompletions("fish")
    // Leaf command flags
    expect(out).toContain("-n '__outlit_using_cmd facts' -l timeframe")
    expect(out).toContain("-n '__outlit_using_cmd sql' -l query-file")
    // Subcommand flags use nested condition
    expect(out).toContain("-n '__outlit_using_cmd customers list' -l billing-status")
    expect(out).toContain("-n '__outlit_using_cmd auth login' -l key")
    expect(out).toContain("-n '__outlit_using_cmd users list' -l journey-stage")
  })

  // ── Error ───────────────────────────────────────────────────────────────

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
