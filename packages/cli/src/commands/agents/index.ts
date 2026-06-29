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
      "  enable <id>                   Enable a configured agent",
      "  disable <id>                  Disable a configured agent",
      "  rename <id> <display-name>    Rename a configured agent",
      "",
      "Examples:",
      "  outlit agents list --json",
      "  outlit agents get agent_123 --json",
      "  outlit agents templates --json",
      "  outlit agents actions --json",
      "  outlit agents create-from-template churn --json",
      "  outlit agents enable agent_123 --json",
      "  outlit agents disable agent_123 --json",
      "  outlit agents rename agent_123 'Churn prevention' --json",
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
    enable: () => import("./enable").then((m) => m.default),
    disable: () => import("./disable").then((m) => m.default),
    rename: () => import("./rename").then((m) => m.default),
  },
})
