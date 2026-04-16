#!/usr/bin/env bun
import { defineCommand, runMain } from "citty"
import { CLI_VERSION } from "./lib/config"
import {
  INTERNAL_UPDATE_FLAG,
  initializeUpdateNotifier,
  runInternalUpdateCheck,
} from "./lib/update"

async function startCli() {
  // citty only handles --version; support -v as a short alias
  if (process.argv.includes("-v")) {
    console.log(CLI_VERSION)
    process.exit(0)
  }

  if (process.argv.includes(INTERNAL_UPDATE_FLAG)) {
    await runInternalUpdateCheck()
    process.exit(0)
  }

  initializeUpdateNotifier()

  const main = defineCommand({
    meta: {
      name: "outlit",
      version: CLI_VERSION,
      description:
        "Outlit CLI -- customer intelligence from the terminal.\n\nUsage examples:\n  outlit customers list --billing-status PAYING --no-activity-in 30d\n  outlit customers get acme.com --include users,revenue\n  outlit customers timeline acme.com --timeframe 90d\n  outlit users list --journey-stage CHAMPION\n  outlit facts list acme.com --fact-types CHURN_RISK,EXPANSION\n  outlit facts get --fact-id fact_123 --include evidence\n  outlit sources get --source-type CALL --source-id call_123\n  outlit search 'pricing objections last quarter' --source-types CALL,EMAIL\n  outlit sql 'SELECT * FROM events LIMIT 10'\n  outlit notify --title 'Risk found' '{\"customer\":\"acme.com\"}'\n  outlit schema events\n  outlit doctor --json\n\nFor AI agents: commands auto-output JSON when stdout is piped. No --json flag needed.",
    },
    subCommands: {
      auth: () => import("./commands/auth/index").then((m) => m.default),
      customers: () => import("./commands/customers/index").then((m) => m.default),
      users: () => import("./commands/users/index").then((m) => m.default),
      doctor: () => import("./commands/doctor").then((m) => m.default),
      upgrade: () => import("./commands/upgrade").then((m) => m.default),
      facts: () => import("./commands/facts/index").then((m) => m.default),
      sources: () => import("./commands/sources/index").then((m) => m.default),
      search: () => import("./commands/search").then((m) => m.default),
      sql: () => import("./commands/sql").then((m) => m.default),
      notify: () => import("./commands/notify").then((m) => m.default),
      schema: () => import("./commands/schema").then((m) => m.default),
      integrations: () => import("./commands/integrations/index").then((m) => m.default),
      completions: () => import("./commands/completions").then((m) => m.default),
      setup: () => import("./commands/setup/index").then((m) => m.default),
    },
  })

  await runMain(main)
}

void startCli()
