import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
// Adding run() causes citty to fire it before the subcommand, producing double output.
export default defineCommand({
  meta: {
    name: "customers",
    description: [
      "Query and filter your customer base.",
      "",
      "Subcommands:",
      "  list      — list customers with filters",
      "  get       — get a specific customer by ID or domain",
      "  timeline  — show activity timeline for a customer",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    timeline: () => import("./timeline").then((m) => m.default),
  },
})
