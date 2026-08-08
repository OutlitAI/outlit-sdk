import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "metrics",
    description: [
      "Configure event-based Outlit Behavior Metrics.",
      "",
      "Commands:",
      "  create                        Create a Behavior Metric",
      "",
      "Examples:",
      "  outlit metrics create --source-key metric_source_v1_0123456789abcdef0123456789abcdef --event-name report_exported --behavior-key reports_exported --label 'Reports exported' --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    create: () => import("./create").then((module) => module.default),
  },
})
