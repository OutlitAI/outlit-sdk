import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
export default defineCommand({
  meta: {
    name: "identity",
    description: [
      "Inspect customer identity coverage and possible split records.",
      "",
      "Commands:",
      "  get <customer>  Show identity coverage and candidate duplicates",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((m) => m.default),
  },
})
