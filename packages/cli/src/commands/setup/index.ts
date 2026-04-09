import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { defineCommand } from "citty"
import { outputArgs } from "../../args/output"
import { TICK } from "../../lib/config"
import { isJsonMode, outputResult } from "../../lib/output"
import { getSkillAgentId, runSkillsInstall, type SetupAgentId } from "./skills"

export type AgentId = SetupAgentId

export function isCommandAvailable(cmd: string): boolean {
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which"
    execFileSync(whichCmd, [cmd], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function getHomeDir(): string {
  return process.env.HOME?.trim() || homedir()
}

export function detectAgents(): AgentId[] {
  const home = getHomeDir()
  const configHome = process.env.XDG_CONFIG_HOME?.trim() || join(home, ".config")
  const detected: AgentId[] = []

  if (isCommandAvailable("claude")) detected.push("claude-code")
  if (isCommandAvailable("codex")) detected.push("codex")
  if (isCommandAvailable("gemini")) detected.push("gemini")
  if (existsSync(join(home, ".factory"))) detected.push("droid")
  if (existsSync(join(configHome, "opencode"))) detected.push("opencode")
  if (existsSync(join(home, ".pi", "agent"))) detected.push("pi")
  if (
    existsSync(join(home, ".openclaw")) ||
    existsSync(join(home, ".clawdbot")) ||
    existsSync(join(home, ".moltbot"))
  ) {
    detected.push("openclaw")
  }

  return detected
}

const agentLabels: Record<AgentId, { label: string; hint: string }> = {
  "claude-code": { label: "Claude Code", hint: "claude CLI found" },
  codex: { label: "Codex", hint: "codex CLI found" },
  gemini: { label: "Gemini CLI", hint: "gemini CLI found" },
  droid: { label: "Droid", hint: ".factory config found" },
  opencode: { label: "OpenCode", hint: "opencode config found" },
  pi: { label: "Pi", hint: ".pi/agent config found" },
  openclaw: { label: "OpenClaw", hint: "OpenClaw config found" },
}

const setupSubcommandNames = new Set([
  "claude-code",
  "codex",
  "gemini",
  "droid",
  "opencode",
  "pi",
  "skills",
])

export default defineCommand({
  meta: {
    name: "setup",
    description: [
      "Install the Outlit skill for coding agents.",
      "",
      "Without a subcommand, auto-detects supported coding agents and installs `outlit` for all of them.",
      "Subcommands: claude-code, codex, gemini, droid, opencode, pi, skills",
    ].join("\n"),
  },
  args: {
    ...outputArgs,
    yes: {
      type: "boolean",
      description: "Install for all detected coding agents without prompting.",
    },
  },
  subCommands: {
    "claude-code": () => import("./claude-code").then((m) => m.default),
    codex: () => import("./codex").then((m) => m.default),
    gemini: () => import("./gemini").then((m) => m.default),
    droid: () => import("./droid").then((m) => m.default),
    opencode: () => import("./opencode").then((m) => m.default),
    pi: () => import("./pi").then((m) => m.default),
    skills: () => import("./skills").then((m) => m.default),
  },
  async run({ args, rawArgs }) {
    // citty executes the parent run() even when a subcommand matched.
    // Bail out so `outlit setup gemini` does not also trigger auto-detect.
    const setupRawArgs = rawArgs ?? []
    const subcommandName = setupRawArgs.find((arg) => !arg.startsWith("-"))
    if (subcommandName && setupSubcommandNames.has(subcommandName)) {
      return
    }

    const json = !!args.json
    const detected = detectAgents()

    if (detected.length === 0) {
      if (isJsonMode(json)) {
        return outputResult({ detected: [], configured: [], failed: [], runner: null })
      }
      console.log("No supported coding agents detected.")
      return
    }

    if (!isJsonMode(json) && !args.yes) {
      console.log("Detected coding agents:")
      for (const agentId of detected) {
        const { label, hint } = agentLabels[agentId]
        console.log(`  ${TICK} ${label.padEnd(14)} -- ${hint}`)
      }
      console.log("\nInstalling Outlit skill...")
    }

    const install = runSkillsInstall({
      json,
      exitOnError: false,
      agents: detected.map(getSkillAgentId),
      skillNames: ["outlit"],
      autoConfirm: true,
    })

    const configured = install.success ? detected : []
    const failed = install.success ? [] : detected

    if (isJsonMode(json)) {
      return outputResult({
        detected,
        configured,
        failed,
        runner: install.runner ?? null,
      })
    }

    if (!install.success) {
      console.log(`\n  ! Outlit skill install failed: ${install.error ?? "unknown error"}`)
      console.log("    Run `outlit setup skills` to retry manually.")
      return
    }

    console.log(`\nDone. Installed Outlit for ${configured.length} coding agent(s).`)
  },
})
