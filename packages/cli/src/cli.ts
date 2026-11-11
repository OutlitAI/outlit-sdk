#!/usr/bin/env bun
import { defineCommand, runMain } from "citty"
import { CLI_VERSION } from "./lib/config"
import { isHelpRequest, renamedNotice, rewriteLegacyArgs } from "./lib/legacy"
import {
  INTERNAL_UPDATE_FLAG,
  initializeUpdateNotifier,
  runInternalUpdateCheck,
} from "./lib/update"

async function startCli() {
  // Prints the embedded skill: no auth, no network, no update check.
  // Only a leading `--skill` counts, so `outlit search -- --skill` stays search data.
  // Return instead of process.exit so piped stdout drains fully under Node.
  const [firstArg, ...skillArgs] = process.argv.slice(2)
  if (firstArg === "--skill") {
    const [skillName, ...extra] = skillArgs
    if ((skillName !== undefined && skillName !== "outlit") || extra.length > 0) {
      const bad = skillName !== undefined && skillName !== "outlit" ? skillName : extra[0]
      process.stderr.write(
        bad?.startsWith("-")
          ? `Unknown option "${bad}" for --skill. Usage: outlit --skill [outlit]\n`
          : `Unknown skill "${bad}". Available: outlit\n`,
      )
      process.exitCode = 1
      return
    }
    const { OUTLIT_SKILL } = await import("./lib/skill")
    process.stdout.write(OUTLIT_SKILL.endsWith("\n") ? OUTLIT_SKILL : `${OUTLIT_SKILL}\n`)
    process.exitCode = 0
    return
  }

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
      description: [
        "Outlit CLI -- customer intelligence from the terminal.",
        "",
        "Usage examples:",
        "  outlit onboard --agent codex --json",
        "  outlit customers list --billing-status PAYING --no-activity-in 30d",
        "  outlit customers get acme.com --include users,revenue",
        "  outlit customers get acme.com --include relationship,credits",
        "  outlit customer-fields list --source hubspot",
        "  outlit timeline get acme.com --timeframe 90d",
        "  outlit people list --journey-stage engaged",
        "  outlit members list --role CSM --has-owned-customers",
        "  outlit facts list acme.com --fact-types CHURN_RISK,EXPANSION",
        "  outlit facts get fact_123 --include evidence",
        "  outlit sources get opportunity opp_123",
        "  outlit search 'pricing objections last quarter' --source-types CALL,OPPORTUNITY",
        "  outlit query 'SELECT * FROM activity LIMIT 10'",
        "  outlit schema get activity",
        "  outlit schema get examples",
        "  outlit tasks list --section open",
        "  outlit tasks act <id> snooze --until 2026-11-14T09:00:00Z",
        "  outlit identity get acme.com",
        "  outlit merge-suggestions list --customer acme.com",
        "  outlit settings update --activation-event integration_connected --json",
        "  outlit activation preview --event integration_connected --json",
        "  outlit destinations update 10000000-0000-4000-8000-000000000003 --enabled false --json",
        "  outlit features list --json",
        "  outlit features create --source-key metric_source_v1_0123456789abcdef0123456789abcdef --event-name report_exported --feature-key reports_exported --name 'Reports exported' --json",
        "  outlit customers get acme.com --include features,meters --weekly --json",
        "  outlit feedback submit --body 'The merge preview dropped trait history' --area customers --json",
        "  outlit doctor --json",
        "  outlit --skill                  # print the Outlit skill for your agent (no auth)",
        "",
        "Toolsets (how Outlit groups its agent tools):",
        "  core      customers, customer-fields, people, facts, sources, timeline, search, query, schema",
        "  work      tasks",
        "  identity  identity, merge-suggestions, customers merge, merges",
        "  admin     members, customers set-owner/set-access, destinations, integrations,",
        "            setup-sessions, settings, activation, features",
        "  meta      feedback",
        "",
        "For AI agents: run `outlit --skill` for the full instructions. Commands auto-output JSON when stdout is piped. No --json flag needed.",
      ].join("\n"),
    },
    subCommands: {
      auth: () => import("./commands/auth/index").then((m) => m.default),
      activation: () => import("./commands/activation/index").then((m) => m.default),
      customers: () => import("./commands/customers/index").then((m) => m.default),
      "customer-fields": () => import("./commands/customer-fields/index").then((m) => m.default),
      identity: () => import("./commands/identity/index").then((m) => m.default),
      "merge-suggestions": () =>
        import("./commands/merge-suggestions/index").then((m) => m.default),
      merges: () => import("./commands/merges/index").then((m) => m.default),
      timeline: () => import("./commands/timeline/index").then((m) => m.default),
      people: () => import("./commands/people/index").then((m) => m.default),
      members: () => import("./commands/members/index").then((m) => m.default),
      tasks: () => import("./commands/tasks/index").then((m) => m.default),
      onboard: () => import("./commands/onboard").then((m) => m.default),
      doctor: () => import("./commands/doctor").then((m) => m.default),
      upgrade: () => import("./commands/upgrade").then((m) => m.default),
      facts: () => import("./commands/facts/index").then((m) => m.default),
      sources: () => import("./commands/sources/index").then((m) => m.default),
      search: () => import("./commands/search").then((m) => m.default),
      feedback: () => import("./commands/feedback/index").then((m) => m.default),
      query: () => import("./commands/query").then((m) => m.default),
      schema: () => import("./commands/schema/index").then((m) => m.default),
      destinations: () => import("./commands/destinations/index").then((m) => m.default),
      features: () => import("./commands/features/index").then((module) => module.default),
      settings: () => import("./commands/settings/index").then((m) => m.default),
      integrations: () => import("./commands/integrations/index").then((m) => m.default),
      "setup-sessions": () => import("./commands/setup-sessions/index").then((m) => m.default),
      completions: () => import("./commands/completions").then((m) => m.default),
      setup: () => import("./commands/setup/index").then((m) => m.default),
    },
  })

  // Old spellings run the new command; each prints one line naming the new spelling.
  const rewrite = rewriteLegacyArgs(process.argv.slice(2))
  if (rewrite?.use && !isHelpRequest(rewrite.argv)) {
    process.stderr.write(`${renamedNotice(rewrite.use)}\n`)
  }

  await runMain(main, rewrite ? { rawArgs: rewrite.argv } : {})
}

void startCli()
