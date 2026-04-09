import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { runAgentSkillsInstall } from "./skills"

export default defineCommand({
  meta: {
    name: "claude-code",
    description: "Install the Outlit skill for Claude Code.",
  },
  args: { ...outputArgs },
  run({ args }) {
    runAgentSkillsInstall("claude-code", !!args.json)
  },
})
