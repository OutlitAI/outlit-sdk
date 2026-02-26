import { execFileSync } from "node:child_process"
import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { TICK, isEnoentError } from "../../lib/config"
import { errorMessage, isJsonMode, outputError, outputResult } from "../../lib/output"

const SKILLS_REPO_URL = "https://github.com/OutlitAI/outlit-agent-skills"
const SKILL_NAMES = ["outlit-cli", "outlit-sdk"]

type PackageRunner = "npx" | "bunx" | "pnpx"

/** Detects the first available package runner on PATH. */
export function detectPackageRunner(): PackageRunner | null {
  const whichCmd = process.platform === "win32" ? "where" : "which"
  for (const runner of ["npx", "bunx", "pnpx"] as const) {
    try {
      execFileSync(whichCmd, [runner], { stdio: "ignore" })
      return runner
    } catch {
      // Not found, try next
    }
  }
  return null
}

/** Builds the argument list for the package runner. npx needs -y to auto-confirm package install. */
function buildRunnerArgs(runner: PackageRunner): string[] {
  const args = runner === "npx" ? ["-y"] : []
  args.push("skills", "add", SKILLS_REPO_URL)
  for (const name of SKILL_NAMES) {
    args.push("--skill", name)
  }
  args.push("-y", "-g")
  return args
}

/**
 * Installs Outlit agent skills via the detected package runner.
 *
 * When `exitOnError` is false, returns { success, error? } instead of calling process.exit.
 * This allows future batch integration if needed.
 */
export function runSkillsInstall(
  json: boolean,
  exitOnError = true,
): { success: boolean; runner?: string; error?: string } {
  const runner = detectPackageRunner()
  if (!runner) {
    if (exitOnError) {
      return outputError(
        {
          message:
            "No package runner found (npx, bunx, or pnpx). Install Node.js, Bun, or pnpm first.",
          code: "runner_not_found",
        },
        json,
      )
    }
    return { success: false, error: "No package runner found" }
  }

  try {
    execFileSync(runner, buildRunnerArgs(runner), { stdio: "pipe" })
  } catch (err) {
    if (exitOnError) {
      if (isEnoentError(err)) {
        return outputError({ message: `${runner} not found`, code: "runner_not_found" }, json)
      }
      return outputError(
        {
          message: errorMessage(err, `${runner} skills add failed`),
          code: "skills_install_error",
        },
        json,
      )
    }
    return {
      success: false,
      runner,
      error: errorMessage(err, `${runner} skills add failed`),
    }
  }

  if (exitOnError) {
    if (isJsonMode(json)) {
      outputResult({ success: true, agent: "skills", runner })
      return { success: true, runner }
    }
    console.log(`${TICK} Agent skills installed (${SKILL_NAMES.join(", ")})`)
  }

  return { success: true, runner }
}

export default defineCommand({
  meta: {
    name: "skills",
    description: [
      "Install Outlit agent skills for Claude Code and other AI agents.",
      "",
      "Downloads outlit-cli and outlit-sdk skills from github.com/OutlitAI/outlit-agent-skills.",
      "No API key required.",
    ].join("\n"),
  },
  args: { ...outputArgs },
  run({ args }) {
    const json = !!args.json
    runSkillsInstall(json)
  },
})
