import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"
import { optionalTrimmedString } from "../../lib/platform-input"

/** `none` clears a setting; the tool takes null for it. */
function clearable(value: string | undefined): string | null | undefined {
  const trimmed = optionalTrimmedString(value)
  if (trimmed === null) return undefined
  return trimmed.toLowerCase() === "none" ? null : trimmed
}

export default defineCommand({
  meta: {
    name: "update",
    description: [
      "Update Outlit workspace settings. Pass only what you change.",
      "",
      "--activation-event is the exact ordinary product event that activates contacts and their",
      "resolved company from now on, without a backfill; `none` turns activation matching off",
      "(existing activation timestamps stay). Preview an event first with `outlit activation preview`.",
      "--default-owner is a member's user ID or email; `none` clears it.",
      "--revision (from `outlit settings get`) refuses the change if settings changed since.",
      "",
      "Examples:",
      "  outlit settings update --timezone America/Los_Angeles --json",
      "  outlit settings update --activation-event integration_connected --json",
      "  outlit settings update --activation-event none --json",
      "  outlit settings update --default-owner sandy@example.com --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    timezone: { type: "string", description: "Default IANA timezone for the workspace" },
    "default-owner": {
      type: "string",
      description: "Default customer owner: a member's user ID or email, or none to clear",
    },
    "activation-event": {
      type: "string",
      description: "Event that activates customers from now on, or none to turn it off",
    },
    revision: {
      type: "string",
      description: "settings.revision from `outlit settings get`; refuses a stale change",
    },
  },
  async run({ args }) {
    const json = !!args.json
    const input: Record<string, unknown> = {}
    const timezone = optionalTrimmedString(args.timezone)
    if (timezone) input.timezone = timezone
    const defaultOwner = clearable(args["default-owner"])
    if (defaultOwner !== undefined) input.defaultOwner = defaultOwner
    const activationEvent = clearable(args["activation-event"])
    if (activationEvent !== undefined) input.activationEvent = activationEvent
    const revision = optionalTrimmedString(args.revision)
    if (revision) input.revision = revision

    if (!("timezone" in input || "defaultOwner" in input || "activationEvent" in input)) {
      return outputError(
        {
          message: "Provide --timezone, --default-owner or --activation-event",
          code: "missing_input",
        },
        json,
      )
    }

    const client = await getClientOrExit(args["api-key"], json)
    return runTool(client, "outlit_update_settings", input, json, {
      spinnerMessage: "Updating settings...",
    })
  },
})
