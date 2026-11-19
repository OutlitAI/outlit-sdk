#!/usr/bin/env bun
import { runMain } from "citty"
import { CLI_VERSION } from "./lib/config"
import { isHelpRequest, renamedNotice, rewriteLegacyArgs } from "./lib/legacy"
import { prepareArgsOrExit, showUsage } from "./lib/strict-args"
import {
  INTERNAL_UPDATE_FLAG,
  initializeUpdateNotifier,
  runInternalUpdateCheck,
} from "./lib/update"
import { mainCommand } from "./main"

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

  // Old spellings run the new command; each prints one line naming the new spelling.
  const rewrite = rewriteLegacyArgs(process.argv.slice(2))
  if (rewrite?.use && !isHelpRequest(rewrite.argv)) {
    process.stderr.write(`${renamedNotice(rewrite.use)}\n`)
  }

  const rawArgs = await prepareArgsOrExit(mainCommand, rewrite?.argv ?? process.argv.slice(2))
  await runMain(mainCommand, { rawArgs, showUsage })
}

void startCli()
