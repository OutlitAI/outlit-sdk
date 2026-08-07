import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "metrics",
    description: [
      "Configure Outlit workspace usage metrics.",
      "",
      "Commands:",
      "  create                        Create a workspace usage metric",
      "",
      "Examples:",
      "  outlit metrics create --name 'Monthly Active Users' --description 'Count of active users in the month' --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    create: () => import("./create").then((m) => m.default),
  },
})
