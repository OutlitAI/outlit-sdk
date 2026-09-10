import { defineCommand } from "citty"

export default defineCommand({
  meta: {
    name: "suggestions",
    description:
      "List saved identity suggestions and history, or reject a suggestion. To merge a reviewed pair, use customers merge.",
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    reject: () => import("./reject").then((m) => m.default),
  },
})
