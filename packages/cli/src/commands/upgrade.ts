import { defineCommand } from "citty"
import { CLI_VERSION } from "../lib/config"
import { errorMessage, outputError } from "../lib/output"
import {
  compareVersions,
  fetchLatestCliVersion,
  getUpgradeCommand,
  runUpgradeCommand,
} from "../lib/update"

export default defineCommand({
  meta: {
    name: "upgrade",
    description: [
      "Upgrade the Outlit CLI using the same package manager it was installed with.",
      "",
      "Checks npm for the latest published version first.",
      "If the current version is already latest, no install command is run.",
      "",
      "Examples:",
      "  outlit upgrade",
    ].join("\n"),
  },
  async run() {
    const upgradeCommand = getUpgradeCommand()
    if (!upgradeCommand) {
      return outputError(
        {
          message:
            "Could not determine how Outlit CLI was installed. Update it manually with your package manager, for example `bun add -g @outlit/cli` or `npm install -g @outlit/cli`.",
          code: "unknown_installer",
        },
        false,
      )
    }

    let latestVersion: string
    try {
      latestVersion = await fetchLatestCliVersion()
    } catch {
      return outputError(
        {
          message: "Could not check for CLI updates. Try again later or update manually.",
          code: "update_check_failed",
        },
        false,
      )
    }

    if (compareVersions(CLI_VERSION, latestVersion) >= 0) {
      console.log(`Outlit CLI is already up to date (v${CLI_VERSION})`)
      return
    }

    try {
      runUpgradeCommand(upgradeCommand)
    } catch (err) {
      return outputError(
        {
          message: errorMessage(err, `Failed to run ${upgradeCommand.displayCommand}`),
          code: "upgrade_failed",
        },
        false,
      )
    }
  },
})
