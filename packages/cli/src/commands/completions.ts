import { defineCommand } from "citty"
import { outputError } from "../lib/output"

// ── Data model ──────────────────────────────────────────────────────────────

type Flag = { readonly name: string; readonly desc: string }
type CmdDef = {
  readonly name: string
  readonly desc: string
  readonly subs?: readonly CmdDef[]
  readonly flags?: readonly Flag[]
}
type CommandPath = { readonly path: readonly string[]; readonly command: CmdDef }

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
      {
        name: "login",
        desc: "Store API key",
        flags: [JSON_F, { name: "--key", desc: "API key to store" }],
      },
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
          { name: "--trait", desc: "Filter by trait key=value pairs" },
          { name: "--billing-status", desc: "Filter by billing status" },
          { name: "--mrr-above", desc: "MRR above threshold (cents)" },
          { name: "--mrr-below", desc: "MRR below threshold (cents)" },
          { name: "--owner-id", desc: "Filter by owner user ID" },
          { name: "--owner-email", desc: "Filter by owner email" },
          { name: "--has-owner", desc: "Only customers with an owner" },
          { name: "--activated-since", desc: "Activated at or after ISO-8601 datetime" },
          { name: "--search", desc: "Search name or domain" },
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
        name: "relationship",
        desc: "Get a bounded customer relationship",
        flags: [...COMMON],
      },
      {
        name: "feature-usage",
        desc: "Get exact Value Feature usage for a customer",
        flags: [...COMMON, { name: "--weeks", desc: "Historical usage window (1-53 weeks)" }],
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
      {
        name: "owner",
        desc: "Manage the primary customer owner",
        subs: [
          {
            name: "set",
            desc: "Assign the primary customer owner",
            flags: [...COMMON, { name: "--target-user-id", desc: "Required workspace-user ID" }],
          },
        ],
      },
      {
        name: "grant",
        desc: "Grant or change Viewer or Editor customer access",
        flags: [
          ...COMMON,
          { name: "--target-user-id", desc: "Required workspace-user ID" },
          { name: "--role", desc: "Required access role (VIEWER, EDITOR)" },
        ],
      },
      {
        name: "revoke",
        desc: "Revoke explicit customer access",
        flags: [...COMMON, { name: "--target-user-id", desc: "Required workspace-user ID" }],
      },
    ],
  },
  {
    name: "attention",
    desc: "Inspect customer Attention items",
    subs: [
      {
        name: "list",
        desc: "List open or resolved Attention items",
        flags: [
          ...PAGINATED,
          { name: "--status", desc: "Lifecycle: open or resolved" },
          { name: "--customer-id", desc: "Filter by exact customer UUID" },
        ],
      },
      { name: "get", desc: "Get one Attention item by exact ID", flags: [...COMMON] },
    ],
  },
  {
    name: "activation",
    desc: "Configure contact and company activation",
    subs: [
      {
        name: "get",
        desc: "Read the configured activation event",
        flags: [...COMMON],
      },
      {
        name: "preview",
        desc: "Preview historical exact-event activation matches",
        flags: [
          ...COMMON,
          { name: "--event", desc: "Exact ordinary product event name" },
          { name: "--lookback-days", desc: "Historical lookback (1-90 days)" },
          { name: "--example-limit", desc: "Historical example count (1-20)" },
        ],
      },
      {
        name: "update",
        desc: "Update the configured activation event",
        flags: [...COMMON, { name: "--event", desc: "Exact ordinary product event name" }],
      },
      {
        name: "disable",
        desc: "Disable future contact and company activation matching",
        flags: [...COMMON],
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
          { name: "--trait", desc: "Filter by trait key=value pairs" },
          { name: "--journey-stage", desc: "Filter by journey stage" },
          { name: "--customer-id", desc: "Filter by customer UUID" },
          { name: "--search", desc: "Search name or email" },
        ],
      },
    ],
  },
  {
    name: "ws-users",
    desc: "Workspace-user operations",
    subs: [
      {
        name: "list",
        desc: "List eligible active workspace members",
        flags: [
          ...PAGINATED,
          { name: "--search", desc: "Search name, email, title, role, or territory" },
          { name: "--role", desc: "Filter by role metadata" },
          { name: "--manager-email", desc: "Filter by manager email" },
          { name: "--has-owned-customers", desc: "Only members who own customers" },
          { name: "--order-by", desc: "Sort field" },
          { name: "--order-direction", desc: "Sort direction (asc, desc)" },
        ],
      },
    ],
  },
  {
    name: "facts",
    desc: "Get customer facts",
    subs: [
      {
        name: "list",
        desc: "List customer facts",
        flags: [
          ...PAGINATED,
          { name: "--status", desc: "Filter by fact status" },
          { name: "--source-types", desc: "Filter by source types" },
          { name: "--fact-types", desc: "Filter by fact types" },
          { name: "--fact-categories", desc: "Filter by fact categories" },
          { name: "--after", desc: "Facts after date (ISO 8601)" },
          { name: "--before", desc: "Facts before date (ISO 8601)" },
        ],
      },
      {
        name: "get",
        desc: "Get a single fact by ID",
        flags: [
          ...COMMON,
          { name: "--fact-id", desc: "Fact ID to fetch" },
          { name: "--include", desc: "Best-effort expansions" },
        ],
      },
    ],
  },
  {
    name: "sources",
    desc: "List or fetch concrete source records",
    subs: [
      {
        name: "list",
        desc: "List source records",
        flags: [
          ...PAGINATED,
          { name: "--source-type", desc: "Source type" },
          { name: "--customer", desc: "Scope to customer" },
          { name: "--participant", desc: "Filter by participant" },
          { name: "--provider", desc: "Filter by provider" },
          { name: "--has-transcript", desc: "Only calls with transcripts" },
          { name: "--after", desc: "Sources after date (ISO 8601)" },
          { name: "--before", desc: "Sources before date (ISO 8601)" },
        ],
      },
      {
        name: "get",
        desc: "Get one exact source record",
        flags: [
          ...PAGINATED,
          { name: "--source-type", desc: "Source type" },
          { name: "--source-id", desc: "Exact source ID" },
        ],
      },
    ],
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
      { name: "--source-types", desc: "Broad source type filter" },
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
  { name: "schema", desc: "Discover analytics view schemas", flags: [...COMMON] },
  {
    name: "integrations",
    desc: "Manage platform integrations",
    subs: [
      {
        name: "setup",
        desc: "Set up or repair an integration",
        flags: [
          ...COMMON,
          { name: "--config-stdin", desc: "Read provider configuration JSON from stdin" },
          { name: "--accept-recommended", desc: "Apply the exact CRM recommendation" },
        ],
      },
      {
        name: "status",
        desc: "Show configuration readiness",
        flags: [...COMMON],
      },
    ],
  },
  {
    name: "destinations",
    desc: "Inspect automation destinations",
    subs: [
      { name: "list", desc: "List configured destinations", flags: [...COMMON] },
      { name: "get", desc: "Get one configured destination", flags: [...COMMON] },
      {
        name: "create",
        desc: "Create a Slack channel destination",
        flags: [
          ...COMMON,
          { name: "--type", desc: "Destination type" },
          { name: "--channel-id", desc: "Slack channel ID" },
          { name: "--label", desc: "Slack channel label" },
          { name: "--default", desc: "Make this the default destination" },
          { name: "--disabled", desc: "Create the destination disabled" },
        ],
      },
      {
        name: "update",
        desc: "Update a Slack channel destination",
        flags: [
          ...COMMON,
          { name: "--type", desc: "Destination type" },
          { name: "--label", desc: "Slack channel label" },
          { name: "--default", desc: "Make this the default destination" },
          { name: "--enabled", desc: "Enable the destination after update" },
          { name: "--disabled", desc: "Disable the destination" },
        ],
      },
      { name: "enable", desc: "Enable a configured destination", flags: [...COMMON] },
      { name: "disable", desc: "Disable a configured destination", flags: [...COMMON] },
      { name: "archive", desc: "Archive a configured destination", flags: [...COMMON] },
    ],
  },
  {
    name: "settings",
    desc: "Configure workspace settings",
    subs: [
      { name: "get", desc: "Get workspace settings", flags: [...COMMON] },
      {
        name: "update",
        desc: "Update workspace settings",
        flags: [...COMMON, { name: "--default-timezone", desc: "Default IANA timezone" }],
      },
    ],
  },
  {
    name: "metrics",
    desc: "Configure Behavior Metrics",
    subs: [
      {
        name: "sources",
        desc: "List product-event sources eligible for Behavior Metrics",
        flags: [...COMMON],
      },
      {
        name: "events",
        desc: "List attributed event candidates for a Behavior Metric source",
        flags: [
          ...COMMON,
          { name: "--source", desc: "Behavior Metric source key" },
          { name: "--weeks", desc: "History window in weeks (1-53, default: 12)" },
          { name: "--limit", desc: "Maximum event candidates (1-100, default: 100)" },
        ],
      },
      {
        name: "create",
        desc: "Create an event-based Behavior Metric",
        flags: [
          ...COMMON,
          { name: "--source", desc: "Behavior Metric source key" },
          { name: "--event", desc: "Exact tracked event name" },
          { name: "--key", desc: "Stable lower_snake_case metric key" },
          { name: "--label", desc: "Human-readable metric label" },
          { name: "--property-filters", desc: "Optional JSON event property filters" },
        ],
      },
    ],
  },
  {
    name: "value-features",
    desc: "Configure Value Features",
    subs: [
      {
        name: "workspace",
        desc: "Read workspace Value Features and usage evidence",
        flags: [
          ...COMMON,
          { name: "--source", desc: "Optional product-event source key" },
          { name: "--weeks", desc: "Historical usage window (1-53 weeks)" },
          { name: "--candidate-limit", desc: "Maximum event candidates (1-100)" },
        ],
      },
      {
        name: "create",
        desc: "Create one event-based Value Feature",
        flags: [
          ...COMMON,
          { name: "--source", desc: "Product-event source key" },
          { name: "--event", desc: "Exact tracked event name" },
          { name: "--key", desc: "Stable lower_snake_case feature key" },
          { name: "--name", desc: "Human-readable Value Feature name" },
          { name: "--property-filters", desc: "Optional JSON exact or exists filters" },
        ],
      },
      {
        name: "archive",
        desc: "Archive a non-final Value Feature",
        flags: [...COMMON, { name: "--revision", desc: "Current opaque feature revision" }],
      },
    ],
  },
  {
    name: "onboard",
    desc: "Prepare a coding agent for Outlit",
    flags: [...COMMON, { name: "--agent", desc: "Agent id" }],
  },
  {
    name: "setup",
    desc: "Install Outlit skills for coding agents",
    flags: [JSON_F, { name: "--yes", desc: "Skip prompts" }],
    subs: [
      { name: "claude-code", desc: "Install the Outlit skill for Claude Code", flags: [JSON_F] },
      { name: "codex", desc: "Install the Outlit skill for Codex", flags: [JSON_F] },
      { name: "gemini", desc: "Install the Outlit skill for Gemini CLI", flags: [JSON_F] },
      { name: "droid", desc: "Install the Outlit skill for Droid", flags: [JSON_F] },
      { name: "opencode", desc: "Install the Outlit skill for OpenCode", flags: [JSON_F] },
      { name: "pi", desc: "Install the Outlit skill for Pi", flags: [JSON_F] },
      { name: "openclaw", desc: "Install the Outlit skill for OpenClaw", flags: [JSON_F] },
      { name: "skills", desc: "Launch the interactive Outlit skills installer", flags: [JSON_F] },
    ],
  },
  { name: "upgrade", desc: "Upgrade the CLI", flags: [] },
  { name: "doctor", desc: "Diagnose environment", flags: [...COMMON] },
  { name: "completions", desc: "Generate shell completions", flags: [] },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function walkCommands(commands: readonly CmdDef[], prefix: readonly string[] = []): CommandPath[] {
  return commands.flatMap((command) => {
    const path = [...prefix, command.name]
    return [{ path, command }, ...walkCommands(command.subs ?? [], path)]
  })
}

const commandPaths = walkCommands(COMMANDS)
const commandsWithSubs = commandPaths.filter(({ command }) => command.subs?.length)
const flagCommandPaths = commandPaths
  .filter(({ command }) => command.flags?.length)
  .sort((left, right) => right.path.length - left.path.length)

function escZsh(s: string): string {
  return s.replace(/'/g, "'\\''")
}

function flagNames(flags: readonly Flag[]): string {
  return flags.map((f) => f.name).join(" ")
}

function bashPathCondition(path: readonly string[]): string {
  return path.map((part, index) => `"\${COMP_WORDS[${index + 1}]}" == "${part}"`).join(" && ")
}

function zshPathCondition(path: readonly string[]): string {
  return path.map((part, index) => `"$words[${index + 2}]" == "${part}"`).join(" && ")
}

function fishPath(path: readonly string[]): string {
  return path.join(" ")
}

// ── Bash ────────────────────────────────────────────────────────────────────

function generateBash(): string {
  const cmdNames = COMMANDS.map((c) => c.name).join(" ")

  const subBlocks = commandsWithSubs
    .map(({ path, command }) => {
      const names = command.subs!.map((s) => s.name).join(" ")
      const parentFlags = command.flags?.length ? ` ${flagNames(command.flags)}` : ""
      return `  if [[ $COMP_CWORD -eq ${path.length + 1} && ${bashPathCondition(path)} ]]; then
    COMPREPLY=($(compgen -W "${names}${parentFlags}" -- "$cur"))
    return
  fi`
    })
    .join("\n")

  const flagBlocks = flagCommandPaths
    .map(
      ({
        path,
        command,
      }) => `  if [[ $COMP_CWORD -gt ${path.length} && ${bashPathCondition(path)} ]]; then
    COMPREPLY=($(compgen -W "${flagNames(command.flags!)}" -- "$cur"))
    return
  fi`,
    )
    .join("\n")

  return `_outlit_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=($(compgen -W "${cmdNames}" -- "$cur"))
    return
  fi

${subBlocks}

${flagBlocks}
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

  const subBlocks = commandsWithSubs
    .map(({ path, command }) => {
      const items = [
        ...command.subs!.map((s) => ({ name: s.name, desc: s.desc })),
        ...(command.flags ?? []).map((f) => ({ name: f.name, desc: f.desc })),
      ]
      return `  if (( CURRENT == ${path.length + 2} )) && [[ ${zshPathCondition(path)} ]]; then
    completions=(${zshDescribe(items)})
    _describe 'subcommand' completions
    return
  fi`
    })
    .join("\n")

  const flagBlocks = flagCommandPaths
    .map(
      ({
        path,
        command,
      }) => `  if (( CURRENT > ${path.length + 1} )) && [[ ${zshPathCondition(path)} ]]; then
    completions=(${zshDescribe(command.flags!)})
    _describe 'option' completions
    return
  fi`,
    )
    .join("\n")

  return `#compdef outlit
_outlit() {
  local -a completions

  if (( CURRENT == 2 )); then
    completions=(${topLevel})
    _describe 'command' completions
    return
  fi

${subBlocks}

${flagBlocks}
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
  for (const { path, command } of commandsWithSubs) {
    lines.push("")
    lines.push(`# ${fishPath(path)} subcommands`)
    for (const sub of command.subs!) {
      lines.push(
        `complete -c outlit -f -n '__outlit_using_cmd ${fishPath(path)}' -a ${sub.name} -d "${esc(sub.desc)}"`,
      )
    }
  }

  // Flags
  for (const { path, command } of flagCommandPaths) {
    lines.push("")
    lines.push(`# ${fishPath(path)} flags`)
    for (const f of command.flags!) {
      const long = f.name.replace(/^--/, "")
      lines.push(
        `complete -c outlit -n '__outlit_using_cmd ${fishPath(path)}' -l ${long} -d "${esc(f.desc)}"`,
      )
    }
  }

  return `${lines.join("\n")}\n`
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
    shell: {
      type: "positional",
      description: "Shell to generate completions for (bash, zsh, fish)",
      required: true,
    },
  },
  run({ args }) {
    const shell = args.shell

    const generate = SCRIPTS[shell]
    if (!generate) {
      return outputError(
        {
          message: `Unknown shell: ${shell}. Supported: bash, zsh, fish`,
          code: "unknown_shell",
        },
        false,
      )
    }

    process.stdout.write(generate())
  },
})
