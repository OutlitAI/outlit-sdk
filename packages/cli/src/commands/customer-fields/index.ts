import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
export default defineCommand({
  meta: {
    name: "customer-fields",
    description: [
      "List the fields Outlit holds about customers: CRM account fields and SDK traits.",
      "",
      "Commands:",
      "  list  List fields, their values in use and how many customers hold one",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
  },
})
