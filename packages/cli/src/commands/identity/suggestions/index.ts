import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../../args/output"

export default defineCommand({
  meta: {
    name: "suggestions",
    description: [
      "Inspect and manage customer identity merge suggestions.",
      "",
      "Commands:",
      "  list                          List identity merge suggestions",
      "  get <id>                      Get one identity merge suggestion",
      "  queue <id>                    Queue one suggested merge for processing",
      "  reject <id>                   Reject one suggested merge",
      "",
      "Examples:",
      "  outlit identity suggestions list --status suggested --json",
      "  outlit identity suggestions get 10000000-0000-4000-8000-000000000001 --json",
      "  outlit identity suggestions queue 10000000-0000-4000-8000-000000000001 --review-notes 'Verified duplicate' --json",
      "  outlit identity suggestions reject 10000000-0000-4000-8000-000000000001 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    queue: () => import("./queue").then((m) => m.default),
    reject: () => import("./reject").then((m) => m.default),
  },
})
