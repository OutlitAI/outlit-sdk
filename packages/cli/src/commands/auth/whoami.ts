import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { outputArgs } from "../../args/output"
import { validateKeyOrExit } from "../../lib/api"
import { maskKey, requireCredential } from "../../lib/config"
import { isJsonMode, outputResult } from "../../lib/output"

export default defineCommand({
  meta: {
    name: "whoami",
    description: [
      "Print the active API key (masked) and its source.",
      "",
      "Validates the key against the Outlit API.",
      "Designed for shell scripting -- outputs a single line in TTY mode.",
      "",
      "Examples:",
      "  outlit auth whoami",
      "  outlit auth whoami --json",
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
  },
  async run({ args }) {
    const json = !!args.json
    const credential = requireCredential(args["api-key"], json)

    const masked = maskKey(credential.key)

    await validateKeyOrExit(credential.key, json)

    if (isJsonMode(json)) {
      return outputResult({ key: masked, source: credential.source, valid: true })
    }

    process.stdout.write(`${masked} (${credential.source})\n`)
  },
})
