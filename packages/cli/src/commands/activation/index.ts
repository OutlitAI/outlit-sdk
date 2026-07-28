import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "activation",
    description: [
      "Inspect, preview, and configure Core-derived company activation.",
      "",
      "Company activation is monotonic and separate from contact journey stages.",
      "",
      "Subcommands:",
      "  get      -- read the saved definition and legacy compatibility state",
      "  preview  -- evaluate a candidate definition historically without mutation",
      "  set      -- replace or explicitly disable the company activation definition",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((module) => module.default),
    preview: () => import("./preview").then((module) => module.default),
    set: () => import("./set").then((module) => module.default),
  },
})
