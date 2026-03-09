import * as p from "@clack/prompts"
import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { OUTLIT_SIGNUP_URL } from "../../lib/config"
import { isJsonMode, outputResult } from "../../lib/output"
import { isInteractive, openBrowser } from "../../lib/tty"

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
      p.intro("Outlit CLI -- Sign Up")
    }

    openBrowser(OUTLIT_SIGNUP_URL)

    if (isInteractive()) {
      p.log.info(`Opening ${OUTLIT_SIGNUP_URL}`)
      p.outro("Once you've signed up, run `outlit auth login` to store your API key.")
    }
  },
})
