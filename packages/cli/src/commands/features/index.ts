import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "features",
    description: [
      "Configure workspace Features and inspect their exact historical usage.",
      "",
      "Commands:",
      "  list                          Read features, evidence, sources, and event candidates",
      "  create                        Create one event-based Feature",
      "  archive <id>                  Archive a non-final Feature",
      "",
      "Customer-level usage is available with `outlit customers features <customer>`.",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((module) => module.default),
    create: () => import("./create").then((module) => module.default),
    archive: () => import("./archive").then((module) => module.default),
  },
})
