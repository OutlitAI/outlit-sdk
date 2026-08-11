import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../../args/output"

export default defineCommand({
  meta: {
    name: "owner",
    description: [
      "Manage a customer's primary owner.",
      "",
      "Commands:",
      "  set -- assign or reassign the primary owner",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    set: () => import("./set").then((m) => m.default),
  },
})
