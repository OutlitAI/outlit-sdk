import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "destinations",
    description: [
      "Configure Outlit automation destinations.",
      "",
      "Commands:",
      "  list                          List configured destinations (--ids reads specific ones)",
      "  create                        Create a Slack channel destination",
      "  update <id>                   Update a destination (--enabled true|false enables or disables)",
      "  archive <id>                  Archive a configured destination (asks first; --yes confirms)",
      "",
      "Examples:",
      "  outlit destinations list --json",
      "  outlit destinations list --ids 10000000-0000-4000-8000-000000000003 --json",
      "  outlit destinations create --type slack --channel-id C0123456789 --label '#customer-ops' --is-default --json",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --is-default --json",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --enabled false --json",
      "  outlit destinations archive 10000000-0000-4000-8000-000000000003 --yes --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    create: () => import("./create").then((m) => m.default),
    update: () => import("./update").then((m) => m.default),
    archive: () => import("./archive").then((m) => m.default),
  },
})
