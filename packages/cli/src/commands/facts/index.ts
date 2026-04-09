import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "facts",
    description: [
      "Query structured customer facts.",
      "",
      "Subcommands:",
      "  list  -- list facts for a customer with filters",
      "  get   -- fetch one exact fact by id",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
  },
})
