import * as p from "@clack/prompts"
import { startCliAuthRequest, waitForCliAuthApproval } from "./cli-auth"
import { DEFAULT_API_URL } from "./config"
import { outputError } from "./output"
import { isInteractive, openBrowser } from "./tty"

export async function runBrowserAuthFlow(json: boolean): Promise<string> {
  const baseUrl = process.env.OUTLIT_API_URL ?? DEFAULT_API_URL
  const session = await startCliAuthRequest(baseUrl)
  const opened = isInteractive() ? openBrowser(session.approveUrl) : false

  process.stderr.write(
    [
      "",
      "Authorize Outlit CLI in your browser:",
      `  ${session.approveUrl}`,
      "",
      `Confirm this terminal code: ${session.userCode}`,
      opened ? "Waiting for browser approval..." : "Waiting after you approve the request...",
      "",
    ].join("\n"),
  )

  const spinner = isInteractive() ? p.spinner() : null
  spinner?.start("Waiting for browser approval...")

  const result = await waitForCliAuthApproval(baseUrl, session, {
    spinnerMessage: "Waiting for browser approval...",
  })

  if (!result) {
    spinner?.stop("Approval timed out")
    return outputError(
      {
        message: "Timed out waiting for browser approval. Run `outlit auth login --browser` again.",
        code: "auth_timeout",
      },
      json,
    )
  }

  if (result.status !== "approved") {
    spinner?.stop("Approval did not complete")
    const message =
      result.status === "failed" && result.error
        ? `Browser authorization failed: ${result.error}`
        : `Browser authorization ${result.status}. Run \`outlit auth login --browser\` again.`
    return outputError(
      {
        message,
        code: `auth_${result.status}`,
      },
      json,
    )
  }

  spinner?.stop("Browser authorization approved")
  return result.apiKey
}
