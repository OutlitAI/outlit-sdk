import { rmSync } from "node:fs"
import { join } from "node:path"
import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { TICK, getConfigDir, isEnoentError } from "../../lib/config"
import { errorMessage, isJsonMode, outputError, outputResult } from "../../lib/output"

export default defineCommand({
  meta: {
    name: "logout",
    description: [
      "Remove the stored Outlit API key.",
      "",
      "Deletes ~/.config/outlit/credentials.json.",
      "Idempotent -- safe to run even if not logged in.",
      "",
      "Note: If OUTLIT_API_KEY env var is set, it continues to work after logout.",
    ].join("\n"),
  },
  args: {
    ...outputArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const configDir = getConfigDir()
    const credPath = join(configDir, "credentials.json")

    if (process.env.OUTLIT_API_KEY) {
      process.stderr.write(
        "Warning: OUTLIT_API_KEY env var is still set and will continue to work after logout.\n",
      )
    }

    try {
      rmSync(credPath, { force: true })
    } catch (err) {
      if (!isEnoentError(err)) {
        return outputError(
          { message: errorMessage(err, "Failed to remove credentials file"), code: "unlink_error" },
          json,
        )
      }
    }

    if (isJsonMode(json)) {
      return outputResult({ success: true })
    }

    process.stdout.write(`${TICK} Logged out. Credentials removed from ${credPath}\n`)
  },
})
