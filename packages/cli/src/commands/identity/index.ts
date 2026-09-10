import { defineCommand } from "citty"

export default defineCommand({
  meta: {
    name: "identity",
    description:
      "Review saved customer identity suggestions. Use customers identity for bounded discovery.",
  },
  subCommands: { suggestions: () => import("./suggestions/index").then((m) => m.default) },
})
