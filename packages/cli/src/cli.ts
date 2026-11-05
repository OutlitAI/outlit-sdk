#!/usr/bin/env bun
import { runMain } from "citty"
import { CLI_VERSION } from "./lib/config"
import { prepareArgsOrExit, showUsage } from "./lib/strict-args"
import {
  INTERNAL_UPDATE_FLAG,
  initializeUpdateNotifier,
  runInternalUpdateCheck,
} from "./lib/update"
import { mainCommand } from "./main"

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

  const rawArgs = await prepareArgsOrExit(mainCommand, process.argv.slice(2))
  await runMain(mainCommand, { rawArgs, showUsage })
}

void startCli()
