import * as p from "@clack/prompts"
import type { CliToolName } from "@outlit/tools"
import type { ArgsDef } from "citty"
import { outputApiError } from "./api"
import type { OutlitClient, OutlitToolParams } from "./client"
import { isJsonMode, outputError, outputResult } from "./output"
import { createSpinner } from "./spinner"

export const yesArg = {
  yes: {
    type: "boolean",
    description: "Confirm without asking (required to confirm when output is not interactive)",
  },
} satisfies ArgsDef

/** What a first call left waiting for a yes: the token that confirms it, and what it would do. */
export interface PendingConfirmation {
  token: string
  /** What the person is about to confirm, one line each. */
  lines: string[]
}

export interface ConfirmedWriteOptions<TToolName extends CliToolName> {
  /** The first call: a preview, or a write that may ask to be confirmed. */
  input: OutlitToolParams<TToolName>
  json: boolean
  yes: boolean
  spinnerMessage: string
  /** Reads the confirmation off the first result; null when that call had already finished. */
  pending: (result: unknown) => PendingConfirmation | null
  /** The confirming call for a token. Give it a fresh requestId: the first call's id was spent. */
  confirmed: (token: string) => OutlitToolParams<TToolName>
  /** The yes/no question asked in a terminal. */
  question: string
  /** What stays true when nobody confirms, said in the same words as the question: "Nothing was archived". */
  unchanged: string
}

/**
 * Runs a write that Core previews before it applies. Core's first answer changes nothing and names
 * the effect; the CLI shows it, asks in a terminal (or takes --yes), and only then sends the
 * confirming call. Without a terminal and without --yes it prints the preview and exits 1, so a
 * script that used to archive in one call never reports success for work that did not happen.
 */
export async function runConfirmedWrite<TToolName extends CliToolName>(
  client: OutlitClient,
  toolName: TToolName,
  options: ConfirmedWriteOptions<TToolName>,
): Promise<void> {
  const { json, yes } = options
  const machineMode = isJsonMode(json)
  const spinner = machineMode ? null : createSpinner(options.spinnerMessage)

  let first: unknown
  try {
    first = await client.callTool(toolName, options.input)
  } catch (error) {
    spinner?.fail("Failed")
    return outputApiError(error, json, { message: "Request failed", code: "api_error" })
  }

  const pending = options.pending(first)
  if (!pending) {
    spinner?.stop("Done")
    return outputResult(first)
  }
  spinner?.stop("Preview ready")

  if (!yes) {
    if (machineMode) {
      outputResult(first)
      return outputError(
        {
          message: `${options.unchanged}. Re-run with --yes to confirm.`,
          code: "confirmation_required",
        },
        json,
      )
    }

    for (const line of pending.lines) process.stderr.write(`${line}\n`)
    const answer = await p.confirm({ message: options.question })
    if (p.isCancel(answer) || answer !== true) {
      return outputError({ message: `${options.unchanged}.`, code: "cancelled" }, json)
    }
  }

  const finish = machineMode ? null : createSpinner(options.spinnerMessage)
  try {
    const result = await client.callTool(toolName, options.confirmed(pending.token))
    finish?.stop("Done")
    return outputResult(result)
  } catch (error) {
    finish?.fail("Failed")
    return outputApiError(error, json, { message: "Request failed", code: "api_error" })
  }
}
