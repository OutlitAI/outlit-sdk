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
      "Commands:",
      "  get                           Get the company activation definition",
      "  preview                       Preview a definition without changing configuration",
      "  update                        Update the company activation definition",
      "  disable                       Disable future company activation evaluation",
      "",
      "Examples:",
      "  outlit activation get --json",
      "  outlit activation preview --signal 10000000-0000-4000-8000-000000000001 --json",
      "  outlit activation update --signal 10000000-0000-4000-8000-000000000001 --json",
      "  outlit activation disable --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    get: () => import("./get").then((module) => module.default),
    preview: () => import("./preview").then((module) => module.default),
    update: () => import("./update").then((module) => module.default),
    disable: () => import("./disable").then((module) => module.default),
  },
})
