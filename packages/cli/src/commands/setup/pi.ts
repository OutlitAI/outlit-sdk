import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { runAgentSkillsInstall } from "./skills"

export default defineCommand({
  meta: {
    name: "pi",
    description: "Install the Outlit skill for Pi.",
  },
  args: { ...outputArgs },
  run({ args }) {
    runAgentSkillsInstall("pi", !!args.json)
  },
})
