import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "settings",
    description: [
      "Configure Outlit workspace settings.",
      "",
      "Commands:",
      "  get                           Get workspace settings",
      "  update                        Update workspace settings",
      "",
      "Examples:",
      "  outlit settings get --json",
      "  outlit settings update --default-timezone America/Los_Angeles --json",
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
