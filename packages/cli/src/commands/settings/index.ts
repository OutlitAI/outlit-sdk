import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "settings",
    description: [
      "Configure Outlit workspace settings: the timezone, the default customer owner and the",
      "activation event.",
      "",
      "Commands:",
      "  get                           Get workspace settings",
      "  update                        Update workspace settings",
      "",
      "Examples:",
      "  outlit settings get --json",
      "  outlit settings update --timezone America/Los_Angeles --json",
      "  outlit settings update --activation-event integration_connected --json",
      "  outlit settings update --activation-event none --json",
      "  outlit destinations list --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((m) => m.default),
    update: () => import("./update").then((m) => m.default),
  },
})
