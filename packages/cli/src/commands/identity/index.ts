import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "identity",
    description: [
      "Inspect and manage Outlit identity resolution.",
      "",
      "Commands:",
      "  suggestions                   Inspect identity merge suggestions",
      "",
      "Examples:",
      "  outlit identity suggestions list --json",
      "  outlit identity suggestions get 10000000-0000-4000-8000-000000000001 --json",
      "  outlit identity suggestions queue 10000000-0000-4000-8000-000000000001 --review-notes 'Looks correct' --json",
      "  outlit identity suggestions reject 10000000-0000-4000-8000-000000000001 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    suggestions: () => import("./suggestions/index").then((m) => m.default),
  },
})
