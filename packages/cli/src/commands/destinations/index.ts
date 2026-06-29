import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "destinations",
    description: [
      "Inspect Outlit automation destinations.",
      "",
      "Commands:",
      "  list                          List configured destinations",
      "",
      "Examples:",
      "  outlit destinations list --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
  },
})
