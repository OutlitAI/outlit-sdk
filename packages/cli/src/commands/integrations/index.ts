import { defineCommand } from "citty"
import { PROVIDER_NAMES } from "../../lib/providers"

export default defineCommand({
  meta: {
    name: "integrations",
    description: [
      "Manage platform integrations (CRM, communication, analytics, etc.).",
      "",
      "Connect third-party services like Salesforce, Slack, and PostHog",
      "to sync data into your Outlit workspace.",
      "",
      "Commands:",
      "  list                List available integrations and connection status",
      "  add <provider>      Connect a new integration (opens browser for OAuth)",
      "  remove <provider>   Disconnect an integration and remove synced data",
      "  status [provider]   Show sync status for connected integrations",
      "",
      `Providers: ${PROVIDER_NAMES.join(", ")}`,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    add: () => import("./add").then((m) => m.default),
    remove: () => import("./remove").then((m) => m.default),
    status: () => import("./status").then((m) => m.default),
  },
})
