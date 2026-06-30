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
      "  report                        Configure report settings",
      "  notifications                 Configure notification settings",
      "",
      "Examples:",
      "  outlit settings get --json",
      "  outlit settings update --default-timezone America/Los_Angeles --json",
      "  outlit settings report get --json",
      "  outlit settings report update --slack-channel-id C123 --slack-channel-name sales-alerts --json",
      "  outlit settings report options --json",
      "  outlit settings notifications get --json",
      "  outlit settings notifications options --json",
      "  outlit settings notifications default set --destination-id 10000000-0000-4000-8000-000000000003 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((m) => m.default),
    update: () => import("./update").then((m) => m.default),
    report: () => import("./report/index").then((m) => m.default),
    notifications: () => import("./notifications/index").then((m) => m.default),
  },
})
