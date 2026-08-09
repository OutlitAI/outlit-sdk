import { defineCommand } from "citty"

export default defineCommand({
  meta: {
    name: "integrations",
    description: [
      "Set up actor-owned integrations and inspect canonical readiness.",
      "",
      "Supported actor-owned setup uses integrations:connect_own; workspace or admin setup uses integrations:manage.",
      "",
      "Commands:",
      "  setup <provider>    Run bounded provider setup when authorized",
      "  status [provider]   Show canonical integration readiness",
      "",
      "Core determines whether the requested setup is actor-owned or workspace/admin scoped.",
    ].join("\n"),
  },
  subCommands: {
    setup: () => import("./setup").then((m) => m.default),
    status: () => import("./status").then((m) => m.default),
  },
})
