import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
// Adding run() causes citty to fire it before the subcommand, producing double output.
export default defineCommand({
  meta: {
    name: "customers",
    description: [
      "Query and filter your customer base.",
      "",
      "Subcommands:",
      "  list      -- list customers with filters",
      "  get       -- get a specific customer by ID or domain",
      "  timeline  -- show activity timeline for a customer",
      "  assign-owner  -- assign a primary customer owner",
      "  grant-access  -- grant Viewer or Editor access",
      "  update-access -- change a collaborator's role",
      "  revoke-access -- remove explicit collaborator access",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    timeline: () => import("./timeline").then((m) => m.default),
    "assign-owner": () => import("./assign-owner").then((m) => m.default),
    "grant-access": () => import("./grant-access").then((m) => m.default),
    "update-access": () => import("./update-access").then((m) => m.default),
    "revoke-access": () => import("./revoke-access").then((m) => m.default),
  },
})
