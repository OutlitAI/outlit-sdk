import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "activation",
    description: [
      "Inspect, preview, and configure the product event used for activation.",
      "",
      "The same exact event activates eligible contacts and their resolved company.",
      "Core writes each activation timestamp once; later matches are no-ops.",
      "",
      "Commands:",
      "  get                           Get the configured activation event",
      "  preview                       Preview historical exact-event matches",
      "  update                        Update the configured activation event",
      "  disable                       Disable future activation matching",
      "",
      "Examples:",
      "  outlit activation get --json",
      "  outlit activation preview --event integration_connected --json",
      "  outlit activation update --event integration_connected --json",
      "  outlit activation disable --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((module) => module.default),
    preview: () => import("./preview").then((module) => module.default),
    update: () => import("./update").then((module) => module.default),
    disable: () => import("./disable").then((module) => module.default),
  },
})
