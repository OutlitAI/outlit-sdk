import { defineCommand } from "citty"

export default defineCommand({
  meta: {
    name: "integrations",
    description: [
      "Manage platform integrations (communication, analytics, billing, etc.).",
      "",
      "Inspect integrations, start safe browser handoffs, and check sync status.",
      "",
      "Commands:",
      "  list                List available integrations and connection status",
      "  capabilities [provider]",
      "                      Show safe setup mode and browser-handoff availability",
      "  setup <provider>    Start a browser handoff when supported",
      "  status --session <id>",
      "                      Poll browser-auth setup status returned by setup JSON output",
      "  status [provider]   Show sync status for connected integrations",
      "",
      "Credential and provider-specific configuration remains in the Outlit web app.",
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    capabilities: () => import("./capabilities").then((m) => m.default),
    setup: () => import("./setup").then((m) => m.default),
    status: () => import("./status").then((m) => m.default),
  },
})
