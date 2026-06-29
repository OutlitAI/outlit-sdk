import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "signals",
    description: [
      "Inspect Outlit automation signals.",
      "",
      "Commands:",
      "  list                          List configured signals",
      "",
      "Examples:",
      "  outlit signals list --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
  },
})
