import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "automations",
    description: [
      "Inspect Outlit automation configuration.",
      "",
      "Commands:",
      "  list                          List configured automations",
      "  get <id>                      Get one configured automation",
      "",
      "Examples:",
      "  outlit automations list --json",
      "  outlit automations get 10000000-0000-4000-8000-000000000001 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
  },
})
