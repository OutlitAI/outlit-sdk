import type { ArgsDef } from "citty"
import { outputError } from "./output"
import { optionalTrimmedString } from "./platform-input"
import { newRequestId } from "./request-id"

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
  "request-id": {
    type: "string",
    description: "Stable retry key: the same id returns the first result (default: a new one)",
  },
} satisfies ArgsDef

export interface WriteMode {
  /** The retry key to send: the one given, or a fresh one. */
  requestId: string
  /** Set when --mode was given: the caller runs exactly that one call, without asking. */
  explicit?: { mode: "preview" | "execute"; previewToken?: string }
}

export function parseWriteMode(
  args: { mode?: string; "preview-token"?: string; "request-id"?: string },
  json: boolean,
): WriteMode {
  const requestId = optionalTrimmedString(args["request-id"]) ?? newRequestId()
  const mode = optionalTrimmedString(args.mode)?.toLowerCase()
  const previewToken = optionalTrimmedString(args["preview-token"]) ?? undefined

  if (!mode) {
    if (previewToken) {
      return outputError(
        { message: "--preview-token needs --mode execute", code: "invalid_input" },
        json,
      )
    }
    return { requestId }
  }
  if (mode !== "preview" && mode !== "execute") {
    return outputError(
      { message: "--mode must be preview or execute", code: "invalid_input" },
      json,
    )
  }
  if (mode === "execute" && !previewToken) {
    return outputError({ message: "Provide --preview-token", code: "missing_input" }, json)
  }
  return { requestId, explicit: { mode, ...(mode === "execute" ? { previewToken } : {}) } }
}
