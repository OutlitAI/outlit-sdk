import type { ArgsDef } from "citty"
import { newIdempotencyKey } from "./idempotency-key"
import { outputError } from "./output"
import { optionalTrimmedString } from "./platform-input"

/** The two-step write inputs shared by the tools that preview before they change anything. */
export const writeModeArgs = {
  mode: {
    type: "string",
    description:
      "preview (changes nothing) or execute (needs --preview-token). Omit to preview, then confirm",
  },
  "preview-token": {
    type: "string",
    description: "preview.token from a preview of the same change, with --mode execute",
  },
  "idempotency-key": {
    type: "string",
    description: "Idempotency key: the same key returns the first result (default: a new one)",
  },
} satisfies ArgsDef

export interface WriteMode {
  /** The retry key to send: the one given, or a fresh one. */
  idempotencyKey: string
  /** Set when --mode was given: the caller runs exactly that one call, without asking. */
  explicit?: { mode: "preview" | "execute"; previewToken?: string }
}

export function parseWriteMode(
  args: { mode?: string; "preview-token"?: string; "idempotency-key"?: string },
  json: boolean,
  options: { executeOnly?: boolean } = {},
): WriteMode {
  const idempotencyKey = optionalTrimmedString(args["idempotency-key"]) ?? newIdempotencyKey()
  const mode = optionalTrimmedString(args.mode)?.toLowerCase()
  const previewToken = optionalTrimmedString(args["preview-token"]) ?? undefined

  if (!mode) {
    if (previewToken) {
      return outputError(
        { message: "--preview-token needs --mode execute", code: "invalid_input" },
        json,
      )
    }
    return { idempotencyKey }
  }
  if (mode !== "preview" && mode !== "execute") {
    return outputError(
      { message: "--mode must be preview or execute", code: "invalid_input" },
      json,
    )
  }
  if (options.executeOnly && mode === "preview") {
    return outputError(
      {
        message: "--mode accepts only execute here: a change that needs confirming says so",
        code: "invalid_input",
      },
      json,
    )
  }
  if (mode === "execute" && !previewToken) {
    return outputError({ message: "Provide --preview-token", code: "missing_input" }, json)
  }
  return { idempotencyKey, explicit: { mode, ...(mode === "execute" ? { previewToken } : {}) } }
}
