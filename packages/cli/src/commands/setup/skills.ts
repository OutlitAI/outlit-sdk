import { execFileSync } from "node:child_process"
import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { isEnoentError, TICK } from "../../lib/config"
import { errorMessage, isJsonMode, outputError, outputResult } from "../../lib/output"

export const SKILLS_REPO_URL = "https://github.com/OutlitAI/outlit-agent-skills"
const DEFAULT_SKILL_NAME = "outlit"

type PackageRunner = "npx" | "bunx" | "pnpx"
export type SkillAgentId =
  | "claude-code"
  | "codex"
  | "gemini-cli"
  | "droid"
  | "opencode"
  | "pi"
  | "openclaw"
export type SetupAgentId =
  | "claude-code"
  | "codex"
  | "gemini"
  | "droid"
  | "opencode"
  | "pi"
  | "openclaw"

const skillAgentMap: Record<SetupAgentId, SkillAgentId> = {
  "claude-code": "claude-code",
  codex: "codex",
  gemini: "gemini-cli",
  droid: "droid",
  opencode: "opencode",
  pi: "pi",
  openclaw: "openclaw",
}

export function getSkillAgentId(agent: SetupAgentId): SkillAgentId {
  return skillAgentMap[agent]
}

export function detectPackageRunner(): PackageRunner | null {
  const whichCmd = process.platform === "win32" ? "where" : "which"
  for (const runner of ["npx", "bunx", "pnpx"] as const) {
    try {
      execFileSync(whichCmd, [runner], { stdio: "ignore" })
      return runner
    } catch {
      // Not found, try next.
    }
  }
  return null
}

function buildRunnerArgs(
  runner: PackageRunner,
  opts: {
    agents?: SkillAgentId[]
    skillNames?: string[]
    autoConfirm?: boolean
    global?: boolean
  },
): string[] {
  const args = runner === "npx" ? ["-y"] : []
  args.push("skills", "add", SKILLS_REPO_URL)

  for (const skillName of opts.skillNames ?? []) {
    args.push("--skill", skillName)
  }

  for (const agent of opts.agents ?? []) {
    args.push("--agent", agent)
  }

  if (opts.autoConfirm) {
    args.push("-y")
  }

  if (opts.global !== false) {
    args.push("-g")
  }

  return args
}

export function runSkillsInstall(opts: {
  json: boolean
  exitOnError?: boolean
  agents?: SkillAgentId[]
  skillNames?: string[]
  reportedAgent?: string
  autoConfirm?: boolean
}): { success: boolean; runner?: PackageRunner; error?: string } {
  const {
    json,
    exitOnError = true,
    agents,
    skillNames,
    reportedAgent = "skills",
    autoConfirm = false,
  } = opts

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

  const isInteractiveInstall =
    (agents?.length ?? 0) === 0 &&
    (skillNames?.length ?? 0) === 0 &&
    !autoConfirm &&
    !isJsonMode(json)

  try {
    execFileSync(runner, buildRunnerArgs(runner, { agents, skillNames, autoConfirm }), {
      stdio: isInteractiveInstall ? "inherit" : "pipe",
    })
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
      outputResult({ success: true, agent: reportedAgent, runner })
      return { success: true, runner }
    }

    if (reportedAgent === "skills") {
      console.log(`${TICK} Outlit skills installer completed (${runner})`)
    } else {
      console.log(`${TICK} Outlit skill installed for ${reportedAgent}`)
    }
  }

  return { success: true, runner }
}

export function runAgentSkillsInstall(
  agent: SetupAgentId,
  json: boolean,
  exitOnError = true,
): { success: boolean; runner?: PackageRunner; error?: string } {
  return runSkillsInstall({
    json,
    exitOnError,
    agents: [getSkillAgentId(agent)],
    skillNames: [DEFAULT_SKILL_NAME],
    reportedAgent: agent,
    autoConfirm: true,
  })
}

export default defineCommand({
  meta: {
    name: "skills",
    description: [
      "Launch the interactive Skills installer for Outlit.",
      "",
      "Uses the Outlit skills repo and lets you choose `outlit` and optional extras like `outlit-sdk`.",
      "No API key required.",
    ].join("\n"),
  },
  args: { ...outputArgs },
  run({ args }) {
    runSkillsInstall({ json: !!args.json })
  },
})
