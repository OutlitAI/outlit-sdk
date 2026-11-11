import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
export default defineCommand({
  meta: {
    name: "setup-sessions",
    description: [
      "Check a browser sign-in that integration setup started.",
      "",
      "Commands:",
      "  get <id>  Read a setup session: pending, connected, expired or failed",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((m) => m.default),
  },
})
