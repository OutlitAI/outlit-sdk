import { defineCommand } from "citty"
import { outputArgs } from "../args/output"
import { outputError } from "../lib/output"

// ── Data model ──────────────────────────────────────────────────────────────

type Flag = { readonly name: string; readonly desc: string }
type SubCmdDef = { readonly name: string; readonly desc: string; readonly flags?: readonly Flag[] }
type CmdDef = {
  readonly name: string
  readonly desc: string
  readonly subs?: readonly SubCmdDef[]
  readonly flags?: readonly Flag[]
}

// Shared flag groups
const JSON_F: Flag = { name: "--json", desc: "Force JSON output" }
const API_KEY_F: Flag = { name: "--api-key", desc: "Outlit API key" }
const LIMIT_F: Flag = { name: "--limit", desc: "Max results (1-100)" }
const CURSOR_F: Flag = { name: "--cursor", desc: "Pagination cursor" }

const COMMON = [API_KEY_F, JSON_F] as const
const PAGINATED = [...COMMON, LIMIT_F, CURSOR_F] as const
const ACTIVITY_ORDER = [
  { name: "--no-activity-in", desc: "No activity in period" },
  { name: "--has-activity-in", desc: "Activity in period" },
  { name: "--order-by", desc: "Sort field" },
  { name: "--order-direction", desc: "Sort direction (asc, desc)" },
] as const

/** Single source of truth for all completion scripts. */
const COMMANDS: readonly CmdDef[] = [
  {
    name: "auth",
    desc: "Manage authentication",
    subs: [
      { name: "signup", desc: "Create an Outlit account", flags: [JSON_F] },
      { name: "login", desc: "Store API key", flags: [JSON_F, { name: "--key", desc: "API key to store" }] },
      { name: "logout", desc: "Remove stored key", flags: [JSON_F] },
      { name: "status", desc: "Check auth state", flags: [...COMMON] },
      { name: "whoami", desc: "Print masked key", flags: [...COMMON] },
    ],
  },
  {
    name: "customers",
    desc: "Customer operations",
    subs: [
      {
        name: "list",
        desc: "List and filter customers",
        flags: [
          ...PAGINATED,
          ...ACTIVITY_ORDER,
          { name: "--billing-status", desc: "Filter by billing status" },
          { name: "--mrr-above", desc: "MRR above threshold (cents)" },
          { name: "--mrr-below", desc: "MRR below threshold (cents)" },
          { name: "--search", desc: "Search name or domain" },
          { name: "--status", desc: "Customer status filter" },
          { name: "--type", desc: "Customer type filter" },
        ],
      },
      {
        name: "get",
        desc: "Get customer by ID or domain",
        flags: [
          ...COMMON,
          { name: "--include", desc: "Sections to include" },
          { name: "--timeframe", desc: "Metrics timeframe" },
        ],
      },
      {
        name: "timeline",
        desc: "Show activity timeline",
        flags: [
          ...PAGINATED,
          { name: "--channels", desc: "Filter by channels" },
          { name: "--event-types", desc: "Filter by event types" },
          { name: "--timeframe", desc: "Event timeframe" },
          { name: "--start-date", desc: "Start date (ISO 8601)" },
          { name: "--end-date", desc: "End date (ISO 8601)" },
        ],
      },
    ],
  },
  {
    name: "users",
    desc: "User operations",
    subs: [
      {
        name: "list",
        desc: "List and filter users",
        flags: [
          ...PAGINATED,
          ...ACTIVITY_ORDER,
          { name: "--journey-stage", desc: "Filter by journey stage" },
          { name: "--customer-id", desc: "Filter by customer UUID" },
          { name: "--search", desc: "Search name or email" },
        ],
      },
    ],
  },
  {
    name: "facts",
    desc: "Get customer facts",
    flags: [...PAGINATED, { name: "--timeframe", desc: "Lookback window (7d, 30d, 90d)" }],
  },
  {
    name: "search",
    desc: "Search customer context",
    flags: [
      ...COMMON,
      { name: "--customer", desc: "Scope to customer (UUID or domain)" },
      { name: "--top-k", desc: "Max results" },
      { name: "--after", desc: "Events after date (ISO 8601)" },
      { name: "--before", desc: "Events before date (ISO 8601)" },
    ],
  },
  {
    name: "sql",
    desc: "Execute SQL queries",
    flags: [
      ...COMMON,
      { name: "--query-file", desc: "Path to .sql file" },
      { name: "--limit", desc: "Max rows to return" },
    ],
  },
  { name: "schema", desc: "Discover table schemas", flags: [...COMMON] },
  {
    name: "setup",
    desc: "Configure AI agent tools",
    flags: [...COMMON, { name: "--yes", desc: "Skip prompts" }],
    subs: [
      { name: "cursor", desc: "Configure Cursor", flags: [...COMMON] },
      { name: "claude-code", desc: "Configure Claude Code", flags: [...COMMON] },
      { name: "claude-desktop", desc: "Configure Claude Desktop", flags: [...COMMON] },
      { name: "vscode", desc: "Configure VS Code", flags: [...COMMON] },
      { name: "gemini", desc: "Configure Gemini CLI", flags: [...COMMON] },
      { name: "openclaw", desc: "Configure OpenClaw", flags: [...COMMON] },
    ],
  },
  { name: "doctor", desc: "Diagnose environment", flags: [...COMMON] },
  { name: "completions", desc: "Generate shell completions", flags: [JSON_F] },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

const cmdsWithSubs = COMMANDS.filter((c) => c.subs?.length)
const leafCmds = COMMANDS.filter((c) => !c.subs?.length && c.flags?.length)

function escZsh(s: string): string {
  return s.replace(/'/g, "'\\''")
}

function flagNames(flags: readonly Flag[]): string {
  return flags.map((f) => f.name).join(" ")
}

// ── Bash ────────────────────────────────────────────────────────────────────

function generateBash(): string {
  const cmdNames = COMMANDS.map((c) => c.name).join(" ")

  // case entries for subcommand completions at position 2
  // Merges parent flags (e.g. setup --yes) alongside subcommand names
  const subCases = cmdsWithSubs
    .map((c) => {
      const names = c.subs!.map((s) => s.name).join(" ")
      const parentFlags = c.flags?.length ? ` ${flagNames(c.flags)}` : ""
      return `      ${c.name}) COMPREPLY=(\$(compgen -W "${names}${parentFlags}" -- "\$cur")) ;;`
    })
    .join("\n")

  // case entries for flag completions (leaf commands keyed by cmd, subcommands by cmd.sub)
  const flagEntries: string[] = []
  for (const cmd of leafCmds) {
    flagEntries.push(`      ${cmd.name}) COMPREPLY=(\$(compgen -W "${flagNames(cmd.flags!)}" -- "\$cur")) ;;`)
  }
  for (const cmd of cmdsWithSubs) {
    for (const sub of cmd.subs!) {
      if (sub.flags?.length) {
        flagEntries.push(
          `      ${cmd.name}.${sub.name}) COMPREPLY=(\$(compgen -W "${flagNames(sub.flags)}" -- "\$cur")) ;;`,
        )
      }
    }
  }
  const flagCases = flagEntries.join("\n")

  return `_outlit_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local cmd="\${COMP_WORDS[1]}"
  local key

  if [[ \$COMP_CWORD -eq 1 ]]; then
    COMPREPLY=(\$(compgen -W "${cmdNames}" -- "\$cur"))
    return
  fi

  case \$cmd in
    ${cmdsWithSubs.map((c) => c.name).join("|")})
      if [[ \$COMP_CWORD -eq 2 ]]; then
        case \$cmd in
${subCases}
        esac
        return
      fi
      key="\${cmd}.\${COMP_WORDS[2]}"
      ;;
    *)
      key=\$cmd
      ;;
  esac

  case \$key in
${flagCases}
  esac
}
complete -F _outlit_completions outlit
`
}

// ── Zsh ─────────────────────────────────────────────────────────────────────

function zshDescribe(items: ReadonlyArray<{ name: string; desc: string }>): string {
  return items.map((c) => `'${escZsh(c.name)}:${escZsh(c.desc)}'`).join(" ")
}

function generateZsh(): string {
  const topLevel = zshDescribe(COMMANDS)

  // subcommand cases -- merges parent flags alongside subcommand names
  const subCases = cmdsWithSubs
    .map((c) => {
      const items = [...c.subs!.map((s) => ({ name: s.name, desc: s.desc })), ...(c.flags ?? []).map((f) => ({ name: f.name, desc: f.desc }))]
      return `    ${c.name})\n      completions=(${zshDescribe(items)})\n      _describe 'subcommand' completions\n      ;;`
    })
    .join("\n")

  // flag cases
  const flagEntries: string[] = []
  for (const cmd of leafCmds) {
    flagEntries.push(
      `    ${cmd.name})\n      completions=(${zshDescribe(cmd.flags!)})\n      _describe 'option' completions\n      ;;`,
    )
  }
  for (const cmd of cmdsWithSubs) {
    for (const sub of cmd.subs!) {
      if (sub.flags?.length) {
        flagEntries.push(
          `    ${cmd.name}.${sub.name})\n      completions=(${zshDescribe(sub.flags)})\n      _describe 'option' completions\n      ;;`,
        )
      }
    }
  }
  const flagCases = flagEntries.join("\n")

  return `#compdef outlit
_outlit() {
  local -a completions
  local cmd=\$words[2]
  local key

  if (( CURRENT == 2 )); then
    completions=(${topLevel})
    _describe 'command' completions
    return
  fi

  case \$cmd in
    ${cmdsWithSubs.map((c) => c.name).join("|")})
      if (( CURRENT == 3 )); then
        case \$cmd in
${subCases}
        esac
        return
      fi
      key="\${cmd}.\$words[3]"
      ;;
    *)
      key=\$cmd
      ;;
  esac

  case \$key in
${flagCases}
  esac
}
compdef _outlit outlit
`
}

// ── Fish ────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/"/g, '\\"')
}

function generateFish(): string {
  const lines: string[] = [
    "# outlit completions for fish shell",
    "",
    "# Helper: true when commandline starts with the given subcommand path",
    "function __outlit_using_cmd",
    "  set -l tokens (commandline -opc)",
    "  set -l n (count $argv)",
    "  if test (count $tokens) -le $n",
    "    return 1",
    "  end",
    "  for i in (seq $n)",
    '    if test "$tokens[(math $i + 1)]" != "$argv[$i]"',
    "      return 1",
    "    end",
    "  end",
    "  return 0",
    "end",
    "",
    "# Top-level commands",
  ]

  for (const c of COMMANDS) {
    lines.push(`complete -c outlit -f -n '__fish_use_subcommand' -a ${c.name} -d "${esc(c.desc)}"`)
  }

  // Subcommands
  for (const cmd of cmdsWithSubs) {
    lines.push("")
    lines.push(`# ${cmd.name} subcommands`)
    for (const sub of cmd.subs!) {
      lines.push(
        `complete -c outlit -f -n '__outlit_using_cmd ${cmd.name}' -a ${sub.name} -d "${esc(sub.desc)}"`,
      )
    }
  }

  // Flags for leaf commands
  for (const cmd of leafCmds) {
    lines.push("")
    lines.push(`# ${cmd.name} flags`)
    for (const f of cmd.flags!) {
      const long = f.name.replace(/^--/, "")
      lines.push(
        `complete -c outlit -n '__outlit_using_cmd ${cmd.name}' -l ${long} -d "${esc(f.desc)}"`,
      )
    }
  }

  // Flags for parent commands with own flags (e.g. setup --yes)
  for (const cmd of cmdsWithSubs) {
    if (cmd.flags?.length) {
      lines.push("")
      lines.push(`# ${cmd.name} flags`)
      for (const f of cmd.flags) {
        const long = f.name.replace(/^--/, "")
        lines.push(
          `complete -c outlit -n '__outlit_using_cmd ${cmd.name}' -l ${long} -d "${esc(f.desc)}"`,
        )
      }
    }
  }

  // Flags for subcommands
  for (const cmd of cmdsWithSubs) {
    for (const sub of cmd.subs!) {
      if (sub.flags?.length) {
        lines.push("")
        lines.push(`# ${cmd.name} ${sub.name} flags`)
        for (const f of sub.flags) {
          const long = f.name.replace(/^--/, "")
          lines.push(
            `complete -c outlit -n '__outlit_using_cmd ${cmd.name} ${sub.name}' -l ${long} -d "${esc(f.desc)}"`,
          )
        }
      }
    }
  }

  return lines.join("\n") + "\n"
}

// ── Script registry ─────────────────────────────────────────────────────────

const SCRIPTS: Record<string, () => string> = {
  bash: generateBash,
  zsh: generateZsh,
  fish: generateFish,
}

export default defineCommand({
  meta: {
    name: "completions",
    description: [
      "Generate shell completion scripts for outlit.",
      "",
      "Supported shells: zsh, bash, fish",
      "",
      "Usage:",
      "  outlit completions zsh >> ~/.zshrc",
      "  outlit completions bash >> ~/.bash_completion",
      "  outlit completions fish > ~/.config/fish/completions/outlit.fish",
      "",
      "After adding the script, restart your shell or source the file.",
    ].join("\n"),
  },
  args: {
    ...outputArgs,
    shell: {
      type: "positional",
      description: "Shell to generate completions for (bash, zsh, fish)",
      required: true,
    },
  },
  run({ args }) {
    const json = !!args.json
    const shell = args.shell

    const generate = SCRIPTS[shell]
    if (!generate) {
      return outputError(
        {
          message: `Unknown shell: ${shell}. Supported: bash, zsh, fish`,
          code: "unknown_shell",
        },
        json,
      )
    }

    process.stdout.write(generate())
  },
})
