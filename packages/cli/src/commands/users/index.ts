import { defineCommand } from "citty"

// The previous name of `outlit people`, kept so scripts that call `outlit users list` keep working.
// Hidden from help and completions; the output is the people list.
// IMPORTANT: No run() here — only meta + subCommands.
export default defineCommand({
  meta: {
    name: "users",
    hidden: true,
    description: "Renamed to `outlit people`.",
  },
  subCommands: {
    list: () => import("../people/list").then((m) => m.default),
  },
})
