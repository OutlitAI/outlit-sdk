import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "sources",
    description: [
      "List or fetch concrete customer source records.",
      "",
      "Subcommands:",
      "  list -- list source records with deterministic filters",
      "  get  -- fetch one exact source by sourceType and sourceId",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
  },
})
