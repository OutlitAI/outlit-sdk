import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "activation",
    description: [
      "Preview the product event used for activation.",
      "",
      "The same exact event activates eligible contacts and their resolved company.",
      "Core writes each activation timestamp once; later matches are no-ops.",
      "Read the configured event with `outlit settings get`; change it with",
      "`outlit settings update --activation-event <event>` (or `none` to turn it off).",
      "",
      "Commands:",
      "  preview                       Preview historical exact-event matches",
      "",
      "Examples:",
      "  outlit activation preview --event integration_connected --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    preview: () => import("./preview").then((module) => module.default),
  },
})
