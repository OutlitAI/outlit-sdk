import { execFileSync } from "node:child_process"
import * as p from "@clack/prompts"
import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { isJsonMode, outputResult } from "../../lib/output"
import { isInteractive, openBrowserCmd } from "../../lib/tty"

const OUTLIT_SIGNUP_URL = "https://app.outlit.ai/sign-up"

export default defineCommand({
  meta: {
    name: "signup",
    description: [
      "Create an Outlit account.",
      "",
      "Opens the Outlit sign-up page in your default browser.",
      "",
      "Examples:",
      "  outlit auth signup        # opens browser",
      "  outlit auth signup --json # outputs URL as JSON",
    ].join("\n"),
  },
  args: { ...outputArgs },
  async run({ args }) {
    const json = !!args.json

    if (isJsonMode(json)) {
      return outputResult({ url: OUTLIT_SIGNUP_URL })
    }

    if (isInteractive()) {
      p.intro("Outlit CLI — Sign Up")
    }

    try {
      if (process.platform === "win32") {
        execFileSync("cmd", ["/c", "start", "", OUTLIT_SIGNUP_URL], { stdio: "ignore" })
      } else {
        execFileSync(openBrowserCmd(), [OUTLIT_SIGNUP_URL], { stdio: "ignore" })
      }
    } catch {
      // Browser open is best-effort
    }

    if (isInteractive()) {
      p.log.info(`Opening ${OUTLIT_SIGNUP_URL}`)
      p.outro("Once you've signed up, run `outlit auth login` to store your API key.")
    }
  },
})
