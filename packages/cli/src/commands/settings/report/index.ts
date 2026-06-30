import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../../args/output"

export default defineCommand({
  meta: {
    name: "report",
    description: [
      "Configure Outlit report settings.",
      "",
      "Commands:",
      "  get                           Get report settings",
      "  update                        Update report settings",
      "  options                       Show report settings options",
      "",
      "Examples:",
      "  outlit settings report get --json",
      "  outlit settings report update --slack-channel-id C123 --slack-channel-name sales-alerts --json",
      "  outlit settings report options --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((m) => m.default),
    update: () => import("./update").then((m) => m.default),
    options: () => import("./options").then((m) => m.default),
  },
})
