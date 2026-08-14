import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "attention",
    description: [
      "Inspect authorized customer Attention items.",
      "",
      "Subcommands:",
      "  list  -- list open or resolved Attention items",
      "  get   -- get one Attention item by exact ID",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((module) => module.default),
    get: () => import("./get").then((module) => module.default),
  },
})
