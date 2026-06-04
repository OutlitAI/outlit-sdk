import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "workspace-users",
    description: [
      "Query internal workspace users such as CSMs and account owners.",
      "",
      "Subcommands:",
      "  list  -- list workspace users with filters",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
  },
})
