import { defineCommand } from "citty"
import { AGENT_JSON_HINT } from "../../args/output"

// IMPORTANT: No run() here — only meta + subCommands.
export default defineCommand({
  meta: {
    name: "tasks",
    description: [
      "Read and act on your task list (the To do page).",
      "",
      "Commands:",
      "  list                   List one section of your tasks",
      "  get <id>               Read a task with its conversation",
      "  act <id> <action>      Take an action on a task",
      "  undo <undo-token>      Reverse an action within 24 hours",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  subCommands: {
    list: () => import("./list").then((m) => m.default),
    get: () => import("./get").then((m) => m.default),
    act: () => import("./act").then((m) => m.default),
    undo: () => import("./undo").then((m) => m.default),
  },
})
