import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "value-features",
    description: [
      "Configure workspace Value Features and inspect their exact historical usage.",
      "",
      "Commands:",
      "  workspace                     Read features, evidence, sources, and event candidates",
      "  create                        Create one event-based Value Feature",
      "  archive <id>                  Archive a non-final Value Feature",
      "",
      "Customer-level usage is available with `outlit customers feature-usage <customer>`.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    workspace: () => import("./workspace").then((module) => module.default),
    create: () => import("./create").then((module) => module.default),
    archive: () => import("./archive").then((module) => module.default),
  },
})
