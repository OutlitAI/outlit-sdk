import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { runAgentSkillsInstall } from "./skills"

export default defineCommand({
  meta: {
    name: "droid",
    description: "Install the Outlit skill for Droid.",
  },
  args: { ...outputArgs },
  run({ args }) {
    runAgentSkillsInstall("droid", !!args.json)
  },
})
