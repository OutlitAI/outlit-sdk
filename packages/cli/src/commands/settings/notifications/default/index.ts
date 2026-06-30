import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../../../args/output"

export default defineCommand({
  meta: {
    name: "default",
    description: [
      "Configure the default notification destination.",
      "",
      "Commands:",
      "  set                           Set the default notification destination",
      "",
      "Examples:",
      "  outlit settings notifications default set --destination-id 10000000-0000-4000-8000-000000000003 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    set: () => import("./set").then((m) => m.default),
  },
})
