import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { runAgentSkillsInstall } from "./skills"

export default defineCommand({
  meta: {
    name: "openclaw",
    description: "Install the Outlit skill for OpenClaw.",
  },
  args: { ...outputArgs },
  run({ args }) {
    runAgentSkillsInstall("openclaw", !!args.json)
  },
})
