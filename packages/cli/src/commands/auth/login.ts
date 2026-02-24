import { execFileSync } from "node:child_process"
import * as p from "@clack/prompts"
import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { pingApiKey } from "../../lib/api"
import { OUTLIT_DASHBOARD_URL, resolveApiKey, storeApiKey } from "../../lib/config"
import { errorMessage, isJsonMode, outputError, outputResult } from "../../lib/output"
import { isInteractive, openBrowserCmd } from "../../lib/tty"

export default defineCommand({
  meta: {
    name: "login",
    description: [
      "Store your Outlit API key.",
      "",
      "The key is validated against the Outlit API before storing.",
      "Stored at ~/.config/outlit/credentials.json with 0600 permissions.",
      "",
      `Get an API key at ${OUTLIT_DASHBOARD_URL}`,
      "",
      "Examples:",
      "  outlit auth login               # interactive (TTY)",
      "  outlit auth login --key ok_xxx  # non-interactive (CI, scripts, agents)",
    ].join("\n"),
  },
  args: {
    ...outputArgs,
    key: {
      type: "string",
      description:
        "API key to store (required in non-interactive / CI mode).\nFormat: ok_ followed by 32+ alphanumeric characters.",
    },
  },
  async run({ args }) {
    const json = !!args.json
    let apiKey = args.key

    if (!apiKey) {
      if (!isInteractive()) {
        return outputError(
          { message: "--key <apiKey> is required in non-interactive mode", code: "missing_key" },
          json,
        )
      }

      p.intro("Outlit CLI -- Login")

      const existing = resolveApiKey()
      if (existing) {
        p.log.info(
          `A key from ${existing.source} is already active. Enter a new key to replace it.`,
        )
      }

      const cancelLogin = () => {
        p.cancel("Login cancelled.")
        process.exit(0)
      }

      const method = await p.select({
        message: "How would you like to get your API key?",
        options: [
          { value: "browser", label: "Open app.outlit.ai in browser" },
          { value: "manual", label: "Enter API key manually" },
        ],
      })
      if (p.isCancel(method)) cancelLogin()

      if (method === "browser") {
        try {
          if (process.platform === "win32") {
            execFileSync("cmd", ["/c", "start", "", OUTLIT_DASHBOARD_URL], { stdio: "ignore" })
          } else {
            execFileSync(openBrowserCmd(), [OUTLIT_DASHBOARD_URL], { stdio: "ignore" })
          }
        } catch {
          // Browser open is best-effort — user can copy URL from the prompt
        }
        p.log.info("Opening browser... paste your key once you have it.")
      }

      const result = await p.password({
        message: "Paste your Outlit API key:",
        validate: (v) => {
          if (!v) return "API key is required"
          if (!v.startsWith("ok_")) return 'Outlit API keys start with "ok_"'
          return undefined
        },
      })
      if (p.isCancel(result)) cancelLogin()
      apiKey = result as string
    }

    if (!apiKey.startsWith("ok_")) {
      return outputError(
        {
          message: 'Invalid API key format. Outlit keys start with "ok_"',
          code: "invalid_key_format",
        },
        json,
      )
    }

    // Validate against the live API before storing
    const spinner = isInteractive() ? p.spinner() : null
    spinner?.start("Verifying API key...")
    try {
      await pingApiKey(apiKey)
      spinner?.stop("API key verified")
    } catch (err) {
      spinner?.stop("Verification failed")
      return outputError(
        {
          message: `Could not verify key: ${errorMessage(err, "unknown error")}. Check your key at ${OUTLIT_DASHBOARD_URL}`,
          code: "validation_failed",
        },
        json,
      )
    }

    let credPath: string
    try {
      credPath = storeApiKey(apiKey)
    } catch (err) {
      return outputError(
        {
          message: `Failed to store credentials: ${errorMessage(err, "unknown error")}`,
          code: "write_error",
        },
        json,
      )
    }

    if (isJsonMode(json)) {
      return outputResult({ success: true, config_path: credPath })
    }

    p.outro(`Stored at ${credPath}\n\n  Next: outlit customers list`)
  },
})
