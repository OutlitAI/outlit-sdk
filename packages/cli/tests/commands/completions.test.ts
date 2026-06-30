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

function bashCompWord(index: number): string {
  return `$${`{COMP_WORDS[${index}]}`}`
}

describe("completions command", () => {
  test("bash — top-level commands", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain("complete -F _outlit_completions outlit")
    expect(out).toContain("facts")
    expect(out).toContain("sources")
    expect(out).toContain("ws-users")
    expect(out).toContain("settings")
    expect(out).not.toContain("workspace-users")
  })

  test("bash — subcommand dispatch", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain(`[[ $COMP_CWORD -eq 2 && "${bashCompWord(1)}" == "facts" ]]`)
    expect(out).toContain('COMPREPLY=($(compgen -W "list get" -- "$cur"))')
    expect(out).toContain(`[[ $COMP_CWORD -eq 2 && "${bashCompWord(1)}" == "sources" ]]`)
    expect(out).toContain(`[[ $COMP_CWORD -eq 2 && "${bashCompWord(1)}" == "ws-users" ]]`)
    expect(out).toContain(`[[ $COMP_CWORD -eq 2 && "${bashCompWord(1)}" == "customers" ]]`)
    expect(out).toContain('COMPREPLY=($(compgen -W "list get timeline" -- "$cur"))')
    expect(out).toContain(`[[ $COMP_CWORD -eq 2 && "${bashCompWord(1)}" == "integrations" ]]`)
    expect(out).toContain('COMPREPLY=($(compgen -W "list capabilities setup status" -- "$cur"))')
    expect(out).not.toContain('COMPREPLY=($(compgen -W "list capabilities setup add')
    expect(out).not.toContain(" add remove ")
    expect(out).toContain("COMP_CWORD -eq 2")
    expect(out).toContain("signup login logout status whoami")
    expect(out).toContain("claude-code codex gemini droid opencode pi openclaw skills --json --yes")
    expect(out).toContain(
      `[[ $COMP_CWORD -eq 3 && "${bashCompWord(1)}" == "agents" && "${bashCompWord(2)}" == "runs" ]]`,
    )
    expect(out).toContain('COMPREPLY=($(compgen -W "list get start" -- "$cur"))')
    expect(out).toContain(`[[ $COMP_CWORD -eq 2 && "${bashCompWord(1)}" == "settings" ]]`)
    expect(out).toContain('COMPREPLY=($(compgen -W "get update report notifications" -- "$cur"))')
    expect(out).toContain(
      `[[ $COMP_CWORD -eq 4 && "${bashCompWord(1)}" == "settings" && "${bashCompWord(2)}" == "notifications" && "${bashCompWord(3)}" == "default" ]]`,
    )
    expect(out).toContain('COMPREPLY=($(compgen -W "set" -- "$cur"))')
  })

  test("bash — flag completions for updated commands", async () => {
    const out = await captureCompletions("bash")
    expect(out).toContain(`[[ $COMP_CWORD -gt 1 && "${bashCompWord(1)}" == "search" ]]`)
    expect(out).toContain(
      'COMPREPLY=($(compgen -W "--api-key --json --customer --top-k --after --before --source-types"',
    )
    expect(out).toContain(
      'COMPREPLY=($(compgen -W "--api-key --json --limit --cursor --status --source-types --fact-types --fact-categories --after --before"',
    )
    expect(out).toContain('COMPREPLY=($(compgen -W "--api-key --json --fact-id --include"')
    expect(out).toContain(
      'COMPREPLY=($(compgen -W "--api-key --json --limit --cursor --source-type --customer --participant --provider --has-transcript --after --before"',
    )
    expect(out).toContain('COMPREPLY=($(compgen -W "--api-key --json --source-type --source-id"')
    expect(out).toContain(
      'COMPREPLY=($(compgen -W "--api-key --json --limit --cursor --no-activity-in --has-activity-in --order-by --order-direction --trait --billing-status --mrr-above --mrr-below --owner-id --owner-email --has-owner --search"',
    )
    expect(out).toContain('COMPREPLY=($(compgen -W "--api-key --json --client-request-id"')
    expect(out).toContain('COMPREPLY=($(compgen -W "--api-key --json --default-timezone"')
    expect(out).toContain(
      'COMPREPLY=($(compgen -W "--api-key --json --slack-channel-id --slack-channel-name"',
    )
    expect(out).toContain('COMPREPLY=($(compgen -W "--api-key --json --destination-id"')
  })

  // ── Zsh ─────────────────────────────────────────────────────────────────

  test("zsh — top-level commands", async () => {
    const out = await captureCompletions("zsh")
    expect(out).toContain("#compdef outlit")
    expect(out).toContain("CURRENT == 2")
    expect(out).toContain("'auth:Manage authentication'")
    expect(out).toContain("'ws-users:Workspace-user operations'")
    expect(out).toContain("'settings:Configure workspace settings'")
    expect(out).not.toContain("workspace-users")
  })

  test("zsh — subcommand dispatch", async () => {
    const out = await captureCompletions("zsh")
    expect(out).toContain("CURRENT == 3")
    expect(out).toContain("'list:List and filter customers'")
    expect(out).toContain("'list:List and filter internal workspace users'")
    expect(out).toContain("'signup:Create an Outlit account'")
    expect(out).toContain("'setup:Run provider auth or follow-up setup'")
    expect(out).not.toContain("'add:Connect an integration'")
    expect(out).not.toContain("'remove:Disconnect an integration'")
    expect(out).toContain("'codex:Install the Outlit skill for Codex'")
    expect(out).toContain("'opencode:Install the Outlit skill for OpenCode'")
  })
  test("zsh — flag completions with descriptions", async () => {
    const out = await captureCompletions("zsh")
    expect(out).toContain("'facts:Get customer facts'")
    expect(out).toContain("'sources:List or fetch concrete source records'")
    expect(out).toContain("'--status:Filter by fact status'")
    expect(out).toContain("'--fact-id:Fact ID to fetch'")
    expect(out).toContain("'--source-type:Source type'")
    expect(out).toContain("'--owner-id:Filter by owner user ID'")
    expect(out).toContain("'--owner-email:Filter by owner email'")
    expect(out).toContain("'--has-owner:Only customers with an owner'")
    expect(out).toContain('[[ "$words[2]" == "facts" && "$words[3]" == "list" ]]')
    expect(out).toContain('[[ "$words[2]" == "sources" && "$words[3]" == "list" ]]')
    expect(out).toContain('[[ "$words[2]" == "sources" && "$words[3]" == "get" ]]')
    expect(out).toContain("'start:Start a manual churn template run'")
    expect(out).toContain("'--client-request-id:Idempotency key for manual run start'")
  })

  test("fish — flag completions with nested commands", async () => {
    const out = await captureCompletions("fish")
    expect(out).toContain("-n '__outlit_using_cmd search' -l source-types")
    expect(out).toContain("-n '__outlit_using_cmd facts list' -l status")
    expect(out).toContain("-n '__outlit_using_cmd facts get' -l fact-id")
    expect(out).toContain("-n '__outlit_using_cmd sources list' -l participant")
    expect(out).toContain("-n '__outlit_using_cmd sources get' -l source-type")
    expect(out).toContain("-n '__outlit_using_cmd customers list' -l billing-status")
    expect(out).toContain("-n '__outlit_using_cmd customers list' -l owner-id")
    expect(out).toContain("-n '__outlit_using_cmd customers list' -l owner-email")
    expect(out).toContain("-n '__outlit_using_cmd customers list' -l has-owner")
    expect(out).toContain("-n '__outlit_using_cmd customers list' -l trait")
    expect(out).toContain("-n '__outlit_using_cmd auth login' -l key")
    expect(out).toContain("-n '__outlit_using_cmd users list' -l journey-stage")
    expect(out).toContain("-n '__outlit_using_cmd users list' -l trait")
    expect(out).toContain("-n '__outlit_using_cmd ws-users list' -l role")
    expect(out).toContain("-n '__outlit_using_cmd ws-users list' -l has-owned-customers")
    expect(out).not.toContain("__outlit_using_cmd workspace-users")
    expect(out).toContain("-n '__outlit_using_cmd integrations setup' -l force")
    expect(out).not.toContain("__outlit_using_cmd integrations add")
    expect(out).not.toContain("__outlit_using_cmd integrations remove")
    expect(out).toContain("-n '__outlit_using_cmd agents runs' -a start")
    expect(out).toContain("-n '__outlit_using_cmd agents runs list' -l limit")
    expect(out).toContain("-n '__outlit_using_cmd agents runs start' -l client-request-id")
    expect(out).toContain("-n '__outlit_using_cmd automations' -a runs")
    expect(out).toContain("-n '__outlit_using_cmd automations runs' -a list")
    expect(out).toContain("-n '__outlit_using_cmd automations runs list' -l limit")
    expect(out).toContain("-n '__outlit_using_cmd automations runs list' -l cursor")
    expect(out).toContain("-n '__outlit_using_cmd settings' -a get")
    expect(out).toContain("-n '__outlit_using_cmd settings report' -a options")
    expect(out).toContain("-n '__outlit_using_cmd settings notifications default' -a set")
    expect(out).toContain("-n '__outlit_using_cmd settings update' -l default-timezone")
    expect(out).toContain("-n '__outlit_using_cmd settings report update' -l slack-channel-id")
    expect(out).toContain("-n '__outlit_using_cmd settings report options' -l search")
    expect(out).toContain("-n '__outlit_using_cmd settings report options' -l limit")
    expect(out).toContain("-n '__outlit_using_cmd settings notifications options' -l search")
    expect(out).toContain("-n '__outlit_using_cmd settings notifications options' -l limit")
    expect(out).toContain(
      "-n '__outlit_using_cmd settings notifications default set' -l destination-id",
    )
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
