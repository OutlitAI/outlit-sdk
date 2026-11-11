import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
export default defineCommand({
  meta: {
    name: "feedback",
    description: [
      "Send product feedback to the Outlit team.",
      "",
      "Commands:",
      "  submit  Submit feedback: bugs, ideas or agent friction",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    submit: () => import("./submit").then((m) => m.default),
  },
})
