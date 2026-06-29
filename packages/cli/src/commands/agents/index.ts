import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "agents",
    description: [
      "Configure Outlit agents from platform templates.",
      "",
      "Commands:",
      "  list                          List configured agents",
      "  get <id>                      Get one configured agent",
      "  templates                     List available agent templates",
      "  actions                       List available agent configuration actions",
      "  create-from-template <template>",
      "                                Create a draft agent from a platform template",
      "",
      "Examples:",
      "  outlit agents list --json",
      "  outlit agents get agent_123 --json",
      "  outlit agents templates --json",
      "  outlit agents actions --json",
      "  outlit agents create-from-template churn --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    templates: () => import("./templates").then((m) => m.default),
    actions: () => import("./actions").then((m) => m.default),
    "create-from-template": () => import("./create-from-template").then((m) => m.default),
  },
})
