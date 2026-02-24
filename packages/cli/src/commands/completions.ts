import { defineCommand } from "citty"
import { outputArgs } from "../args/output"
import { outputError } from "../lib/output"

/** Top-level subcommands — single source of truth for all completion scripts. */
const COMMANDS: ReadonlyArray<{ name: string; desc: string }> = [
  { name: "auth", desc: "Manage authentication" },
  { name: "customers", desc: "Customer operations" },
  { name: "users", desc: "User operations" },
  { name: "facts", desc: "Get customer facts" },
  { name: "search", desc: "Search customer context" },
  { name: "sql", desc: "Execute SQL queries" },
  { name: "schema", desc: "Discover table schemas" },
  { name: "setup", desc: "Configure AI agent tools" },
  { name: "doctor", desc: "Diagnose environment" },
  { name: "completions", desc: "Generate shell completions" },
]

const cmdNames = COMMANDS.map((c) => c.name).join(" ")

const BASH_SCRIPT = `_outlit_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=(\$(compgen -W "${cmdNames}" -- "\$cur"))
}
complete -F _outlit_completions outlit
`

const zshCommands = COMMANDS.map((c) => `'${c.name}:${c.desc}'`).join(" ")

const ZSH_SCRIPT = `#compdef outlit
_outlit() {
  local -a commands
  commands=(${zshCommands})
  _describe 'command' commands
}
compdef _outlit outlit
`

const FISH_SCRIPT = `# outlit completions for fish shell
${COMMANDS.map((c) => `complete -c outlit -f -a ${c.name} -d '${c.desc}'`).join("\n")}
`

const SCRIPTS: Record<string, string> = {
  bash: BASH_SCRIPT,
  zsh: ZSH_SCRIPT,
  fish: FISH_SCRIPT,
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

    const script = SCRIPTS[shell]
    if (!script) {
      return outputError(
        {
          message: `Unknown shell: ${shell}. Supported: bash, zsh, fish`,
          code: "unknown_shell",
        },
        json,
      )
    }

    process.stdout.write(script)
  },
})
