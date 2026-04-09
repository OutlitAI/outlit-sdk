import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { runAgentSkillsInstall } from "./skills"

export default defineCommand({
  meta: {
    name: "opencode",
    description: "Install the Outlit skill for OpenCode.",
  },
  args: { ...outputArgs },
  run({ args }) {
    runAgentSkillsInstall("opencode", !!args.json)
  },
})
