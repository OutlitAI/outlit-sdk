import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { outputArgs } from "../../args/output"
import { validateKeyOrExit } from "../../lib/api"
import { TICK, maskKey, requireCredential } from "../../lib/config"
import { isJsonMode, outputResult } from "../../lib/output"

export default defineCommand({
  meta: {
    name: "status",
    description: [
      "Check current authentication state.",
      "",
      "Validates the active API key against the Outlit API.",
      "",
      "Examples:",
      "  outlit auth status",
      "  outlit auth status --json",
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
      return outputResult({ authenticated: true, source: credential.source, key: masked })
    }

    console.log(`${TICK} Authenticated\n  Key:    ${masked}\n  Source: ${credential.source}`)
  },
})
