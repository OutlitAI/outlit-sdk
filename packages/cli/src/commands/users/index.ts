import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
// Adding run() causes citty to fire it before the subcommand, producing double output.
export default defineCommand({
  meta: {
    name: "users",
    description: [
      "Query and filter users across your customer base.",
      "",
      "Subcommands:",
      "  list  -- list users with filters",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
  },
})
