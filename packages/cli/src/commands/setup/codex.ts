import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { runAgentSkillsInstall } from "./skills"

export default defineCommand({
  meta: {
    name: "codex",
    description: "Install the Outlit skill for Codex.",
  },
  args: { ...outputArgs },
  run({ args }) {
    runAgentSkillsInstall("codex", !!args.json)
  },
})
