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
const JSON_BODY = [
  ...COMMON,
  { name: "--data", desc: "Inline JSON request body" },
  { name: "--file", desc: "Path to JSON request body" },
] as const
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
        desc: "List and filter internal workspace users",
        flags: [
          ...PAGINATED,
          { name: "--search", desc: "Search name, email, title, role, or territory" },
          { name: "--role", desc: "Filter by role metadata" },
          { name: "--manager-email", desc: "Filter by manager email" },
          { name: "--has-owned-customers", desc: "Only users who own customers" },
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
          ...COMMON,
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
      { name: "list", desc: "List integrations and status", flags: [...COMMON] },
      { name: "capabilities", desc: "Show setup capabilities", flags: [JSON_F] },
      {
        name: "setup",
        desc: "Run provider auth or follow-up setup",
        flags: [
          ...COMMON,
          { name: "--config", desc: "JSON config for credentials or follow-up setup" },
          { name: "--force", desc: "Reconnect if already connected" },
        ],
      },
      {
        name: "status",
        desc: "Show sync or setup-session status",
        flags: [...COMMON, { name: "--session", desc: "Browser-auth setup session ID" }],
      },
    ],
  },
  {
    name: "agents",
    desc: "Configure Outlit agents",
    subs: [
      { name: "list", desc: "List configured agents", flags: [...COMMON] },
      { name: "get", desc: "Get one configured agent", flags: [...COMMON] },
      { name: "templates", desc: "List available agent templates", flags: [...COMMON] },
      { name: "actions", desc: "List available agent configuration actions", flags: [...COMMON] },
      {
        name: "runs",
        desc: "Inspect and start agent runs",
        subs: [
          { name: "list", desc: "List runs for one agent", flags: [...PAGINATED] },
          { name: "get", desc: "Get one agent run", flags: [...COMMON] },
          {
            name: "start",
            desc: "Start a manual churn template run",
            flags: [
              ...COMMON,
              { name: "--client-request-id", desc: "Idempotency key for manual run start" },
            ],
          },
        ],
      },
      {
        name: "create",
        desc: "Create an agent",
        flags: [
          ...COMMON,
          { name: "--template", desc: "Agent template key to create" },
          { name: "--type", desc: "Agent type to create" },
          { name: "--display-name", desc: "Agent display name" },
          { name: "--instructions", desc: "Agent instructions" },
          { name: "--surface-criteria", desc: "Criteria for surfacing items" },
          { name: "--skip-criteria", desc: "Optional criteria for skipping items" },
          { name: "--max-items-to-surface", desc: "Maximum items surfaced per run" },
          { name: "--action-keys", desc: "Comma-separated action keys" },
        ],
      },
      {
        name: "update",
        desc: "Update an agent",
        flags: [
          ...COMMON,
          { name: "--display-name", desc: "Agent display name" },
          { name: "--instructions", desc: "Agent instructions" },
          { name: "--action-keys", desc: "Comma-separated action keys" },
          { name: "--clear-action-keys", desc: "Clear all action keys" },
        ],
      },
      { name: "enable", desc: "Enable a configured agent", flags: [...COMMON] },
      { name: "disable", desc: "Disable a configured agent", flags: [...COMMON] },
      { name: "rename", desc: "Rename a configured agent", flags: [...COMMON] },
    ],
  },
  {
    name: "automations",
    desc: "Inspect automation configuration",
    subs: [
      { name: "list", desc: "List configured automations", flags: [...COMMON] },
      { name: "get", desc: "Get one configured automation", flags: [...COMMON] },
      {
        name: "runs",
        desc: "Inspect automation runs",
        subs: [
          {
            name: "list",
            desc: "List automation runs",
            flags: [
              ...COMMON,
              { name: "--limit", desc: "Max rows" },
              { name: "--cursor", desc: "Pagination cursor" },
            ],
          },
          { name: "get", desc: "Get one automation run", flags: [...COMMON] },
        ],
      },
      { name: "options", desc: "Show automation schemas and constants", flags: [...COMMON] },
      { name: "create", desc: "Create an agent automation", flags: [...JSON_BODY] },
      { name: "update", desc: "Update an agent automation", flags: [...JSON_BODY] },
      { name: "enable", desc: "Enable a configured automation", flags: [...COMMON] },
      { name: "disable", desc: "Disable a configured automation", flags: [...COMMON] },
      { name: "archive", desc: "Archive a configured automation", flags: [...COMMON] },
    ],
  },
  {
    name: "signals",
    desc: "Inspect automation signals",
    subs: [
      { name: "list", desc: "List configured signals", flags: [...COMMON] },
      { name: "get", desc: "Get one configured signal", flags: [...COMMON] },
      { name: "options", desc: "Show signal schemas and catalog options", flags: [...COMMON] },
      { name: "create", desc: "Create an automation signal", flags: [...JSON_BODY] },
      { name: "update", desc: "Update an automation signal", flags: [...JSON_BODY] },
      { name: "archive", desc: "Archive a configured signal", flags: [...COMMON] },
    ],
  },
  {
    name: "destinations",
    desc: "Inspect automation destinations",
    subs: [
      { name: "list", desc: "List configured destinations", flags: [...COMMON] },
      { name: "get", desc: "Get one configured destination", flags: [...COMMON] },
      {
        name: "options",
        desc: "Show destination schemas and Slack channels",
        flags: [
          ...COMMON,
          { name: "--search", desc: "Search Slack channels" },
          { name: "--limit", desc: "Max Slack channels (1-100)" },
        ],
      },
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
    name: "identity",
    desc: "Inspect and manage identity resolution",
    subs: [
      {
        name: "suggestions",
        desc: "Inspect customer identity merge suggestions",
        subs: [
          {
            name: "list",
            desc: "List identity merge suggestions",
            flags: [
              ...COMMON,
              { name: "--status", desc: "Filter by suggestion status" },
              { name: "--confidence", desc: "Filter by confidence" },
              { name: "--limit", desc: "Max results (1-100)" },
            ],
          },
          { name: "get", desc: "Get one identity merge suggestion", flags: [...COMMON] },
          {
            name: "queue",
            desc: "Queue one suggested identity merge",
            flags: [...COMMON, { name: "--review-notes", desc: "Review notes" }],
          },
          {
            name: "reject",
            desc: "Reject one suggested identity merge",
            flags: [...COMMON, { name: "--review-notes", desc: "Review notes" }],
          },
        ],
      },
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
      {
        name: "report",
        desc: "Configure report settings",
        subs: [
          { name: "get", desc: "Get report settings", flags: [...COMMON] },
          {
            name: "update",
            desc: "Update report settings",
            flags: [
              ...COMMON,
              { name: "--slack-channel-id", desc: "Slack channel ID" },
              { name: "--slack-channel-name", desc: "Slack channel name" },
            ],
          },
          {
            name: "options",
            desc: "Show report settings options",
            flags: [
              ...COMMON,
              { name: "--search", desc: "Search Slack channels" },
              { name: "--limit", desc: "Max Slack channels (1-100)" },
            ],
          },
        ],
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
