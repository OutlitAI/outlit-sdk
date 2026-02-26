import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { outputArgs } from "../../args/output"
import { TICK, getClaudeDesktopConfigPath, requireCredential } from "../../lib/config"
import { isJsonMode, outputResult } from "../../lib/output"
import { configureSafe as configureClaudeCode } from "./claude-code"
import { configureSafe as configureClaudeDesktop } from "./claude-desktop"
import { configureSafe as configureCursor } from "./cursor"
import { configureSafe as configureGemini } from "./gemini"
import { configureSafe as configureOpenclaw } from "./openclaw"
import { configureSafe as configureVscode } from "./vscode"

export type AgentId = "cursor" | "claude-code" | "claude-desktop" | "vscode" | "gemini" | "openclaw"

export function isCommandAvailable(cmd: string): boolean {
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which"
    execFileSync(whichCmd, [cmd], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

export function detectAgents(): AgentId[] {
  const home = homedir()
  const detected: AgentId[] = []

  if (existsSync(join(home, ".cursor"))) detected.push("cursor")
  if (isCommandAvailable("claude")) detected.push("claude-code")
  if (existsSync(getClaudeDesktopConfigPath())) detected.push("claude-desktop")
  if (isCommandAvailable("code") || existsSync(join(process.cwd(), ".vscode")))
    detected.push("vscode")
  if (isCommandAvailable("gemini")) detected.push("gemini")
  if (existsSync(join(home, "clawd", "skills")) || existsSync(join(home, ".openclaw", "skills")))
    detected.push("openclaw")

  return detected
}

const agentLabels: Record<AgentId, { label: string; hint: string }> = {
  cursor: { label: "Cursor", hint: "~/.cursor/" },
  "claude-code": { label: "Claude Code", hint: "claude CLI found" },
  "claude-desktop": { label: "Claude Desktop", hint: "config file found" },
  vscode: { label: "VS Code", hint: "code CLI or .vscode/ found" },
  gemini: { label: "Gemini CLI", hint: "gemini CLI found" },
  openclaw: { label: "OpenClaw", hint: "skills directory found" },
}

const configurators: Record<AgentId, (key: string, json: boolean) => boolean> = {
  cursor: configureCursor,
  "claude-code": configureClaudeCode,
  "claude-desktop": configureClaudeDesktop,
  vscode: configureVscode,
  gemini: configureGemini,
  openclaw: configureOpenclaw,
}

export default defineCommand({
  meta: {
    name: "setup",
    description: [
      "Configure Outlit for AI agent tools.",
      "",
      "Without a subcommand, auto-detects installed agents and configures them all.",
      "Subcommands: cursor, claude-code, claude-desktop, vscode, gemini, openclaw, skills",
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    yes: {
      type: "boolean",
      description: "Configure all detected agents without prompting.",
    },
  },
  subCommands: {
    cursor: () => import("./cursor").then((m) => m.default),
    "claude-code": () => import("./claude-code").then((m) => m.default),
    "claude-desktop": () => import("./claude-desktop").then((m) => m.default),
    vscode: () => import("./vscode").then((m) => m.default),
    gemini: () => import("./gemini").then((m) => m.default),
    openclaw: () => import("./openclaw").then((m) => m.default),
    skills: () => import("./skills").then((m) => m.default),
  },
  async run({ args }) {
    const json = !!args.json
    const credential = requireCredential(args["api-key"], json)

    const detected = detectAgents()

    if (detected.length === 0) {
      if (isJsonMode(json)) {
        return outputResult({ detected: [], configured: [], failed: [] })
      }
      console.log("No supported agent tools detected.")
      return
    }

    // Interactive: show detected agents before configuring
    if (!isJsonMode(json) && !args.yes) {
      console.log("Detected agents:")
      for (const agentId of detected) {
        const { label, hint } = agentLabels[agentId]
        console.log(`  ${TICK} ${label.padEnd(14)} -- ${hint}`)
      }
      console.log("\nConfiguring...")
    }

    const configured: AgentId[] = []
    const failed: AgentId[] = []

    for (const agentId of detected) {
      const ok = configurators[agentId](credential.key, json)
      if (ok) {
        configured.push(agentId)
      } else {
        failed.push(agentId)
      }
    }

    if (isJsonMode(json)) {
      return outputResult({ detected, configured, failed })
    }

    if (failed.length > 0) {
      console.log(`\n  ${failed.length} agent(s) failed: ${failed.join(", ")}`)
    }
    console.log(`\nDone. ${configured.length}/${detected.length} agent(s) configured successfully.`)
  },
})
