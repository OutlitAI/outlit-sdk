import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

export default defineCommand({
  meta: {
    name: "destinations",
    description: [
      "Configure Outlit automation destinations.",
      "",
      "Commands:",
      "  list                          List configured destinations",
      "  get <id>                      Get one configured destination",
      "  create                        Create an automation destination",
      "  update <id>                   Update an automation destination",
      "  enable <id>                   Enable a configured destination",
      "  disable <id>                  Disable a configured destination",
      "  archive <id>                  Archive a configured destination",
      "",
      "Examples:",
      "  outlit destinations list --json",
      "  outlit destinations get 10000000-0000-4000-8000-000000000003 --json",
      "  outlit destinations create --type webhook --name 'Customer ops' --url https://hooks.example.com/outlit --json",
      "  outlit destinations update 10000000-0000-4000-8000-000000000003 --type webhook --name 'Customer ops' --json",
      "  outlit destinations enable 10000000-0000-4000-8000-000000000003 --json",
      "  outlit destinations disable 10000000-0000-4000-8000-000000000003 --json",
      "  outlit destinations archive 10000000-0000-4000-8000-000000000003 --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    create: () => import("./create").then((m) => m.default),
    update: () => import("./update").then((m) => m.default),
    enable: () => import("./enable").then((m) => m.default),
    disable: () => import("./disable").then((m) => m.default),
    archive: () => import("./archive").then((m) => m.default),
  },
})
