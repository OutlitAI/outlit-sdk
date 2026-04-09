import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { outputArgs } from "../args/output"
import { pingApiKey } from "../lib/api"
import { createClient } from "../lib/client"
import type { CredentialResult } from "../lib/config"
import { CLI_VERSION, maskKey, OUTLIT_DASHBOARD_URL, resolveApiKey, TICK } from "../lib/config"
import { errorMessage, isJsonMode, outputResult } from "../lib/output"
import { isUnicodeSupported } from "../lib/tty"
import { fetchLatestCliVersion, formatUpdateCommand } from "../lib/update"
import { type AgentId, detectAgents as detectInstalledAgents } from "./setup/index"

type Status = "pass" | "warn" | "fail"
interface CheckResult {
  name: string
  status: Status
  message: string
  detail?: string
}

const FAIL_SYMBOL = isUnicodeSupported ? String.fromCodePoint(0x2717) : "x"

const STATUS_ICONS: Record<Status, string> = {
  pass: TICK,
  warn: "\x1b[33m!\x1b[0m",
  fail: `\x1b[31m${FAIL_SYMBOL}\x1b[0m`,
}

export default defineCommand({
  meta: {
    name: "doctor",
    description: [
      "Check CLI version, API key, connectivity, and agent detection.",
      "",
      "Runs four checks in sequence:",
      "  1. CLI version -- compares against npm registry",
      "  2. API key -- checks presence and format (ok_ prefix)",
      "  3. API validation -- makes a live test call to verify the key works",
      "  4. Agent detection -- detects supported coding agents and whether the Outlit skill is installed",
      "",
      "Exit code: 0 if all checks pass or warn, 1 if any check fails.",
      "",
      "JSON output format:",
      '  { "ok": boolean, "checks": [{ "name", "status", "message", "detail?" }] }',
      "",
      "Examples:",
      "  outlit doctor",
      "  outlit doctor --json",
      "  outlit doctor --json | jq '.checks[] | select(.status == \"fail\")'",
      "",
      "For AI agents: use outlit doctor --json to get structured diagnostics.",
    ].join("\n"),
  },
  args: { ...authArgs, ...outputArgs },
  async run({ args }) {
    const json = !!args.json
    const checks: CheckResult[] = []

    checks.push(await checkCliVersion())

    const credential = resolveApiKey(args["api-key"])
    checks.push(checkApiKeyPresence(credential))

    if (credential) {
      const apiCheck = await validateApiKey(credential.key)
      checks.push(apiCheck)

      if (apiCheck.status !== "fail") {
        checks.push(await checkIntegrations(credential.key))
      }
    } else {
      checks.push({
        name: "API validation",
        status: "fail",
        message: "Skipped -- no API key found",
      })
    }

    checks.push(...detectAgents())

    const hasFail = checks.some((c) => c.status === "fail")

    if (isJsonMode(json)) {
      outputResult({ ok: !hasFail, checks })
    } else {
      printChecks(checks)
    }
    if (hasFail) process.exit(1)
  },
})

async function checkCliVersion(): Promise<CheckResult> {
  const current = CLI_VERSION
  try {
    const latest = await fetchLatestCliVersion()
    if (latest === current) {
      return { name: "CLI version", status: "pass", message: `v${current} (latest)` }
    }
    return {
      name: "CLI version",
      status: "warn",
      message: `v${current} installed, v${latest} available`,
      detail: `Run \`${formatUpdateCommand()}\` to update`,
    }
  } catch {
    return {
      name: "CLI version",
      status: "warn",
      message: `v${current} (could not check for updates)`,
    }
  }
}

function checkApiKeyPresence(credential: CredentialResult | null): CheckResult {
  if (!credential) {
    return {
      name: "API key",
      status: "fail",
      message: "No API key found",
      detail: "Run `outlit auth login` or set OUTLIT_API_KEY",
    }
  }
  if (!credential.key.startsWith("ok_")) {
    return {
      name: "API key",
      status: "fail",
      message: `Invalid format -- expected ok_ prefix, got "${credential.key.slice(0, 3)}..."`,
      detail: `Get a valid key at ${OUTLIT_DASHBOARD_URL}`,
    }
  }
  return {
    name: "API key",
    status: "pass",
    message: `Found (${maskKey(credential.key)}) via ${credential.source}`,
  }
}

async function validateApiKey(apiKey: string): Promise<CheckResult> {
  try {
    await pingApiKey(apiKey)
    return { name: "API validation", status: "pass", message: "Key is valid" }
  } catch (err) {
    return {
      name: "API validation",
      status: "fail",
      message: `API rejected key: ${errorMessage(err, "unknown error")}`,
      detail: `Check your key at ${OUTLIT_DASHBOARD_URL}`,
    }
  }
}

async function checkIntegrations(apiKey: string): Promise<CheckResult> {
  try {
    const client = await createClient(apiKey)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Integrations check timed out")), 10_000),
    )
    const data = (await Promise.race([
      client.callTool("outlit_list_integrations", {}),
      timeout,
    ])) as {
      items?: Array<{ status: string }>
    }
    const items = data.items ?? []
    const connected = items.filter((i) => i.status === "connected").length
    const errors = items.filter((i) => i.status === "error").length

    if (errors > 0) {
      return {
        name: "Integrations",
        status: "warn",
        message: `${connected} connected, ${errors} with errors`,
        detail: "Run `outlit integrations status` for details",
      }
    }
    if (connected === 0) {
      return {
        name: "Integrations",
        status: "pass",
        message: "No integrations connected",
        detail: "Run `outlit integrations list` to see available integrations",
      }
    }
    return {
      name: "Integrations",
      status: "pass",
      message: `${connected} integration(s) connected`,
    }
  } catch {
    return {
      name: "Integrations",
      status: "warn",
      message: "Could not check integrations",
      detail: "Integration status endpoint may not be available yet",
    }
  }
}

const agentChecks: Record<AgentId, { name: string; missingDetail: string }> = {
  "claude-code": {
    name: "Claude Code",
    missingDetail: "Run `outlit setup claude-code` to install the Outlit skill",
  },
  codex: {
    name: "Codex",
    missingDetail: "Run `outlit setup codex` to install the Outlit skill",
  },
  gemini: {
    name: "Gemini CLI",
    missingDetail: "Run `outlit setup gemini` to install the Outlit skill",
  },
  droid: {
    name: "Droid",
    missingDetail: "Run `outlit setup droid` to install the Outlit skill",
  },
  opencode: {
    name: "OpenCode",
    missingDetail: "Run `outlit setup opencode` to install the Outlit skill",
  },
  pi: {
    name: "Pi",
    missingDetail: "Run `outlit setup pi` to install the Outlit skill",
  },
  openclaw: {
    name: "OpenClaw",
    missingDetail: "Run `outlit setup skills` and choose OpenClaw",
  },
}

function getHomeDir(): string {
  return process.env.HOME?.trim() || homedir()
}

function getSharedSkillsDir(): string {
  return join(getHomeDir(), ".agents", "skills")
}

function getOpenClawHome(): string {
  const home = getHomeDir()

  if (existsSync(join(home, ".openclaw"))) return join(home, ".openclaw")
  if (existsSync(join(home, ".clawdbot"))) return join(home, ".clawdbot")
  if (existsSync(join(home, ".moltbot"))) return join(home, ".moltbot")

  return join(home, ".openclaw")
}

function getAgentSkillDir(agentId: AgentId): string {
  const home = getHomeDir()

  switch (agentId) {
    case "claude-code":
      return join(process.env.CLAUDE_CONFIG_DIR?.trim() || join(home, ".claude"), "skills")
    case "codex":
      return getSharedSkillsDir()
    case "gemini":
      return getSharedSkillsDir()
    case "droid":
      return join(home, ".factory", "skills")
    case "opencode":
      return getSharedSkillsDir()
    case "pi":
      return join(home, ".pi", "agent", "skills")
    case "openclaw":
      return join(getOpenClawHome(), "skills")
  }
}

function detectAgents(): CheckResult[] {
  const detected = detectInstalledAgents()
  if (detected.length === 0) {
    return [
      {
        name: "AI agents",
        status: "pass",
        message: "No agents detected (none required for CLI usage)",
      },
    ]
  }

  const results: CheckResult[] = []

  for (const agentId of detected) {
    const meta = agentChecks[agentId]
    const hasSkill = existsSync(join(getAgentSkillDir(agentId), "outlit", "SKILL.md"))

    results.push({
      name: meta.name,
      status: hasSkill ? "pass" : "warn",
      message: hasSkill ? "Outlit skill installed" : "Installed, but Outlit skill not found",
      detail: hasSkill ? undefined : meta.missingDetail,
    })
  }

  return results
}

function printChecks(checks: CheckResult[]): void {
  console.log("\n  Outlit Doctor\n")
  for (const c of checks) {
    console.log(`  ${STATUS_ICONS[c.status]} ${c.name}: ${c.message}`)
    if (c.detail) console.log(`    ${c.detail}`)
  }
  const warns = checks.filter((c) => c.status === "warn").length
  const fails = checks.filter((c) => c.status === "fail").length
  console.log("")
  if (fails > 0) {
    console.log(`  ${fails} issue(s) need attention.`)
  } else if (warns > 0) {
    console.log(`  Everything works, ${warns} suggestion(s).`)
  } else {
    console.log("  All checks passed.")
  }
  console.log("")
}
