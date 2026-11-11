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
      "  list        -- list customers with filters",
      "  get         -- get a customer by ID or domain, with sections such as revenue, relationship,",
      "                 features, meters and credits (--include)",
      "  merge       -- preview an exact pair; --mode execute requires reviewed inputs",
      "  set-owner   -- assign a primary customer owner",
      "  set-access  -- grant, change or remove Viewer or Editor access (--role none removes)",
      "",
      "Related: `outlit timeline get`, `outlit identity get`, `outlit merge-suggestions`,",
      "`outlit merges get` and `outlit customer-fields list`.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    merge: () => import("./merge").then((m) => m.default),
    "set-owner": () => import("./set-owner").then((m) => m.default),
    "set-access": () => import("./set-access").then((m) => m.default),
  },
})
