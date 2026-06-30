import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../../args/output"

export default defineCommand({
  meta: {
    name: "notifications",
    description: [
      "Configure Outlit notification settings.",
      "",
      "Commands:",
      "  get                           Get notification settings",
      "  options                       Show notification settings options",
      "  default                       Configure the default notification destination",
      "",
      "Examples:",
      "  outlit settings notifications get --json",
      "  outlit settings notifications options --json",
      "  outlit settings notifications default set --destination-id 10000000-0000-4000-8000-000000000003 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((m) => m.default),
    options: () => import("./options").then((m) => m.default),
    default: () => import("./default/index").then((m) => m.default),
  },
})
