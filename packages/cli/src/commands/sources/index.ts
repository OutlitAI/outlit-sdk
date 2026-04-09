import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "sources",
    description: [
      "Fetch concrete customer sources by type and id.",
      "",
      "Subcommands:",
      "  get  -- fetch one exact source by sourceType and sourceId",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((m) => m.default),
  },
})
