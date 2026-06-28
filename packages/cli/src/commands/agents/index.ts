import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "agents",
    description: [
      "Configure Outlit agents from platform templates.",
      "",
      "Commands:",
      "  templates                     List available agent templates",
      "  actions                       List available agent configuration actions",
      "  create-from-template <template>",
      "                                Create a draft agent from a platform template",
      "",
      "Examples:",
      "  outlit agents templates --json",
      "  outlit agents actions --json",
      "  outlit agents create-from-template churn --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    templates: () => import("./templates").then((m) => m.default),
    actions: () => import("./actions").then((m) => m.default),
    "create-from-template": () => import("./create-from-template").then((m) => m.default),
  },
})
