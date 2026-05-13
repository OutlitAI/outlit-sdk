import { defineCommand } from "citty"
import { PROVIDER_NAMES } from "../../lib/providers"

export default defineCommand({
  meta: {
    name: "integrations",
    description: [
      "Manage platform integrations (communication, analytics, billing, etc.).",
      "",
      "Connect third-party services like Slack, Stripe, and PostHog",
      "to sync data into your Outlit workspace.",
      "",
      "Commands:",
      "  list                List available integrations and connection status",
      "  capabilities [provider]",
      "                      Show auth mode, setup support, required fields, and follow-up steps",
      "  setup <provider> [step]",
      "                      Run provider auth setup or inspect follow-up steps",
      "  status --session <id>",
      "                      Poll browser/Nango setup status returned by setup/add JSON output",
      "  add <provider>      Connect a new integration (legacy alias for direct connect)",
      "  remove <provider>   Disconnect an integration and remove synced data",
      "  status [provider]   Show sync status for connected integrations",
      "",
      `Providers: ${PROVIDER_NAMES.join(", ")}`,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    capabilities: () => import("./capabilities").then((m) => m.default),
    setup: () => import("./setup").then((m) => m.default),
    add: () => import("./add").then((m) => m.default),
    remove: () => import("./remove").then((m) => m.default),
    status: () => import("./status").then((m) => m.default),
  },
})
