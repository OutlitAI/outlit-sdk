import { defineCommand } from "citty"
import { outputArgs } from "../args/output"
import { CLI_VERSION } from "../lib/config"
import { errorMessage, isJsonMode, outputError, outputResult } from "../lib/output"
import {
  compareVersions,
  fetchLatestCliVersion,
  getUpgradeCommand,
  isStandaloneInstall,
  runUpgradeCommand,
} from "../lib/update"

const STANDALONE_UPDATE_HINT =
  "re-run your original install method (for example `curl -fsSL https://outlit.ai/install.sh | bash` or `brew upgrade outlitai/tap/outlit`), or download the latest release from https://github.com/OutlitAI/outlit-sdk/releases"

export default defineCommand({
  meta: {
    name: "upgrade",
    description: [
      "Upgrade the Outlit CLI using the same package manager it was installed with.",
      "",
      "Checks npm for the latest published version first.",
      "If the current version is already latest, no install command is run.",
      "Standalone binaries cannot self-update; they get manual-update guidance instead.",
      "",
      "Examples:",
      "  outlit upgrade",
    ].join("\n"),
  },
  args: { ...outputArgs },
  async run({ args }) {
    const json = !!args.json

    let latestVersion: string
    try {
      latestVersion = await fetchLatestCliVersion()
    } catch {
      return outputError(
        {
          message: "Could not check for CLI updates. Try again later or update manually.",
          code: "update_check_failed",
        },
        json,
      )
    }

    if (compareVersions(CLI_VERSION, latestVersion) >= 0) {
      const result = { status: "current", currentVersion: CLI_VERSION, latestVersion }
      if (isJsonMode(json)) return outputResult(result)
      console.log(`Outlit CLI is already up to date (v${CLI_VERSION})`)
      return
    }

    const standalone = isStandaloneInstall()
    const upgradeCommand = standalone ? null : getUpgradeCommand()
    if (!upgradeCommand) {
      const message = standalone
        ? `Outlit CLI v${latestVersion} is available. This standalone binary cannot update itself — ${STANDALONE_UPDATE_HINT}.`
        : `Outlit CLI v${latestVersion} is available. Could not determine how Outlit CLI was installed. Update it manually with your package manager, for example \`bun add -g @outlit/cli\` or \`npm install -g @outlit/cli\`.`
      return outputError({ message, code: "unknown_installer" }, json)
    }

    try {
      runUpgradeCommand(upgradeCommand, { stdoutToStderr: isJsonMode(json) })
    } catch (err) {
      return outputError(
        {
          message: errorMessage(err, `Failed to run ${upgradeCommand.displayCommand}`),
          code: "upgrade_failed",
        },
        json,
      )
    }

    const result = {
      status: "updated",
      currentVersion: CLI_VERSION,
      latestVersion,
      command: upgradeCommand.displayCommand,
    }
    if (isJsonMode(json)) return outputResult(result)
    console.log(`Updated Outlit CLI to v${latestVersion}`)
  },
})
