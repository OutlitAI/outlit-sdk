import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../../args/output"

export default defineCommand({
  meta: {
    name: "runs",
    description: [
      "Inspect and start agent runs.",
      "",
      "Commands:",
      "  list <agent-id>               List runs for an agent",
      "  get <agent-id> <run-id>        Get one agent run",
      "  start <agent-id>               Start a manual churn template run",
      "",
      "Examples:",
      "  outlit agents runs list 10000000-0000-4000-8000-000000000004 --json",
      "  outlit agents runs get 10000000-0000-4000-8000-000000000004 run_123 --json",
      "  outlit agents runs start 10000000-0000-4000-8000-000000000004 --client-request-id smoke-123 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    start: () => import("./start").then((m) => m.default),
  },
})
