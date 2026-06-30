import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "signals",
    description: [
      "Configure Outlit automation signals.",
      "",
      "Commands:",
      "  list                          List configured signals",
      "  get <id>                      Get one configured signal",
      "  options                       Show signal schemas and catalog options",
      "  create                        Create an automation signal",
      "  update <id>                   Update an automation signal",
      "  archive <id>                  Archive a configured signal",
      "",
      "Examples:",
      "  outlit signals list --json",
      "  outlit signals get 10000000-0000-4000-8000-000000000002 --json",
      "  outlit signals options --json",
      "  outlit signals create --file ./signal.json --json",
      "  outlit signals update 10000000-0000-4000-8000-000000000002 --file ./signal.json --json",
      "  outlit signals archive 10000000-0000-4000-8000-000000000002 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    options: () => import("./options").then((m) => m.default),
    create: () => import("./create").then((m) => m.default),
    update: () => import("./update").then((m) => m.default),
    archive: () => import("./archive").then((m) => m.default),
  },
})
