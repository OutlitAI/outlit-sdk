import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "metrics",
    description: [
      "Configure event-based Outlit Behavior Metrics.",
      "",
      "Commands:",
      "  sources                       List eligible event sources",
      "  events                        List event candidates for a source",
      "  create                        Create a Behavior Metric",
      "",
      "Examples:",
      "  outlit metrics sources --json",
      "  outlit metrics events --source metric_source_v1_0123456789abcdef0123456789abcdef --json",
      "  outlit metrics create --source metric_source_v1_0123456789abcdef0123456789abcdef --event report_exported --key reports_exported --label 'Reports exported' --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    sources: () => import("./sources").then((module) => module.default),
    events: () => import("./events").then((module) => module.default),
    create: () => import("./create").then((module) => module.default),
  },
})
