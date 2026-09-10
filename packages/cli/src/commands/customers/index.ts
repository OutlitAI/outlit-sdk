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
      "  relationship -- get the bounded relationship for a customer",
      "  identity  -- inspect identity coverage and possible split records",
      "  merge     -- preview an exact pair; --execute requires reviewed inputs",
      "  merge-status -- read an admitted merge operation",
      "  features  -- get exact Feature usage for a customer",
      "  timeline  -- show activity timeline for a customer",
      "  owner set -- assign a primary customer owner",
      "  grant     -- grant or change Viewer or Editor access",
      "  revoke    -- remove explicit collaborator access",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    relationship: () => import("./relationship").then((m) => m.default),
    identity: () => import("./identity").then((m) => m.default),
    merge: () => import("./merge").then((m) => m.default),
    "merge-status": () => import("./merge-status").then((m) => m.default),
    features: () => import("./features").then((m) => m.default),
    timeline: () => import("./timeline").then((m) => m.default),
    owner: () => import("./owner").then((m) => m.default),
    grant: () => import("./grant").then((m) => m.default),
    revoke: () => import("./revoke").then((m) => m.default),
  },
})
