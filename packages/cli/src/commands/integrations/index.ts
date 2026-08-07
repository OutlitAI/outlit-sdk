import { defineCommand } from "citty"

export default defineCommand({
  meta: {
    name: "integrations",
    description: [
      "Manage platform integrations (communication, analytics, billing, etc.).",
      "",
      "Start safe browser handoffs and check canonical readiness.",
      "",
      "Commands:",
      "  setup <provider>    Start a browser handoff when supported",
      "  status [provider]   Show canonical integration readiness",
      "",
      "Credential and provider-specific configuration remains in the Outlit web app.",
    ].join("\n"),
  },
  subCommands: {
    setup: () => import("./setup").then((m) => m.default),
    status: () => import("./status").then((m) => m.default),
  },
})
