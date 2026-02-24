#!/usr/bin/env bun
import { defineCommand, runMain } from "citty"
import { CLI_VERSION } from "./lib/config"

const main = defineCommand({
  meta: {
    name: "outlit",
    version: CLI_VERSION,
    description:
      "Outlit CLI — customer intelligence from the terminal.\n\nUsage examples:\n  outlit customers list --billing-status PAYING --no-activity-in 30d\n  outlit customers get acme.com --include users,revenue\n  outlit customers timeline acme.com --timeframe 90d\n  outlit users list --journey-stage CHAMPION\n  outlit facts acme.com --timeframe 90d\n  outlit search 'pricing objections last quarter'\n  outlit sql 'SELECT * FROM events LIMIT 10'\n  outlit schema events\n  outlit doctor --json\n\nFor AI agents: commands auto-output JSON when stdout is piped. No --json flag needed.",
  },
  subCommands: {
    auth: () => import("./commands/auth/index").then((m) => m.default),
    customers: () => import("./commands/customers/index").then((m) => m.default),
    users: () => import("./commands/users/index").then((m) => m.default),
    doctor: () => import("./commands/doctor").then((m) => m.default),
    facts: () => import("./commands/facts").then((m) => m.default),
    search: () => import("./commands/search").then((m) => m.default),
    sql: () => import("./commands/sql").then((m) => m.default),
    schema: () => import("./commands/schema").then((m) => m.default),
    completions: () => import("./commands/completions").then((m) => m.default),
    setup: () => import("./commands/setup/index").then((m) => m.default),
  },
})

runMain(main)
