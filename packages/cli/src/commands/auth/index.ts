import { defineCommand } from "citty"

// IMPORTANT: No run() here — only meta + subCommands.
// If you add run(), citty will fire it BEFORE any subcommand when the user types
// `outlit auth login`. You will see the parent output AND the login output.
// Use setup() if you need shared initialization logic across all auth subcommands.
export default defineCommand({
  meta: {
    name: "auth",
    description: [
      "Manage Outlit CLI authentication.",
      "",
      "Subcommands:",
      "  signup  — create an Outlit account",
      "  login   — store API key",
      "  logout  — remove stored key",
      "  status  — check current auth state",
      "  whoami  — print masked key for scripting",
    ].join("\n"),
  },
  subCommands: {
    signup: () => import("./signup").then((m) => m.default),
    login: () => import("./login").then((m) => m.default),
    logout: () => import("./logout").then((m) => m.default),
    status: () => import("./status").then((m) => m.default),
    whoami: () => import("./whoami").then((m) => m.default),
  },
})
