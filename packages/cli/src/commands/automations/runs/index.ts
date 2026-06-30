import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../../args/output"

export default defineCommand({
  meta: {
    name: "runs",
    description: [
      "Inspect automation runs.",
      "",
      "Commands:",
      "  list <automation-id>          List runs for an automation",
      "  get <automation-id> <run-id>   Get one automation run",
      "",
      "Examples:",
      "  outlit automations runs list 10000000-0000-4000-8000-000000000001 --json",
      "  outlit automations runs get 10000000-0000-4000-8000-000000000001 10000000-0000-4000-8000-000000000006 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
  },
})
