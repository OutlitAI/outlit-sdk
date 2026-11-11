import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
export default defineCommand({
  meta: {
    name: "schema",
    description: [
      "Describe what outlit query can read.",
      "",
      "Commands:",
      "  get [view]  Describe the views, one view, events or examples",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((m) => m.default),
  },
})
