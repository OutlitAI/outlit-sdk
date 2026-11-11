import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
export default defineCommand({
  meta: {
    name: "merge-suggestions",
    description: [
      "Review saved customer merge suggestions. To merge a reviewed pair, use customers merge.",
      "",
      "Commands:",
      "  list    List saved suggestions and history",
      "  reject  Reject a suggestion",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    reject: () => import("./reject").then((m) => m.default),
  },
})
