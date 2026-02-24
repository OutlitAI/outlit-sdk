import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { outputArgs } from "../args/output"
import { pingApiKey } from "../lib/api"
import type { CredentialResult } from "../lib/config"
import {
  CLI_VERSION,
  OUTLIT_DASHBOARD_URL,
  TICK,
  getClaudeDesktopConfigPath,
  maskKey,
  readJsonConfig,
  resolveApiKey,
} from "../lib/config"
import { errorMessage, isJsonMode, outputResult } from "../lib/output"
import { type AgentId, detectAgents as detectInstalledAgents } from "./setup/index"

type Status = "pass" | "warn" | "fail"
interface CheckResult {
  name: string
  status: Status
  message: string
  detail?: string
}

const STATUS_ICONS: Record<Status, string> = {
  pass: TICK,
  warn: "\x1b[33m!\x1b[0m",
  fail: "\x1b[31m✗\x1b[0m",
}

export default defineCommand({
  meta: {
    name: "doctor",
    description: [
      "Check CLI version, API key, connectivity, and agent detection.",
      "",
      "Runs four checks in sequence:",
      "  1. CLI version — compares against npm registry",
      "  2. API key — checks presence and format (ok_ prefix)",
      "  3. API validation — makes a live test call to verify the key works",
      "  4. Agent detection — detects OpenClaw, Cursor, Claude Desktop, VS Code",
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
      checks.push(await validateApiKey(credential.key))
    } else {
      checks.push({ name: "API validation", status: "fail", message: "Skipped — no API key found" })
    }

    checks.push(...detectAgents())

    const hasFail = checks.some((c) => c.status === "fail")

    if (isJsonMode(json)) {
      outputResult({ ok: !hasFail, checks })
    } else {
      printChecks(checks)
    }
    process.exit(hasFail ? 1 : 0)
  },
})

async function checkCliVersion(): Promise<CheckResult> {
  const current = CLI_VERSION
  try {
    const res = await fetch("https://registry.npmjs.org/@outlit%2Fcli/latest", {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error("registry unavailable")
    const data = (await res.json()) as { version?: string }
    const latest = data.version ?? "unknown"
    if (latest === current) {
      return { name: "CLI version", status: "pass", message: `v${current} (latest)` }
    }
    return {
      name: "CLI version",
      status: "warn",
      message: `v${current} installed, v${latest} available`,
      detail: "Run `npm update -g @outlit/cli` to update",
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
      message: `Invalid format — expected ok_ prefix, got "${credential.key.slice(0, 3)}..."`,
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

/** Metadata for each agent used to generate rich CheckResults from detected AgentIds. */
const agentChecks: Record<AgentId, { name: string; configCheck?: { path: string; key: string } }> =
  {
    cursor: {
      name: "Cursor",
      configCheck: { path: join(homedir(), ".cursor", "mcp.json"), key: "mcpServers" },
    },
    "claude-code": { name: "Claude Code" },
    "claude-desktop": {
      name: "Claude Desktop",
      configCheck: { path: getClaudeDesktopConfigPath(), key: "mcpServers" },
    },
    vscode: {
      name: "VS Code",
      configCheck: { path: join(process.cwd(), ".vscode", "mcp.json"), key: "servers" },
    },
    gemini: { name: "Gemini CLI" },
    openclaw: { name: "OpenClaw" },
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
  const home = homedir()

  for (const agentId of detected) {
    const meta = agentChecks[agentId]

    // OpenClaw: check for SKILL.md
    if (agentId === "openclaw") {
      const openclawBase = existsSync(join(home, "clawd", "skills"))
        ? join(home, "clawd", "skills")
        : join(home, ".openclaw", "skills")
      const hasSkill = existsSync(join(openclawBase, "outlit-intelligence", "SKILL.md"))
      results.push({
        name: meta.name,
        status: hasSkill ? "pass" : "warn",
        message: hasSkill
          ? "Installed, Outlit skill configured"
          : "Installed, but Outlit skill not found",
        detail: hasSkill ? undefined : "Run `outlit setup openclaw` to configure",
      })
      continue
    }

    // CLI-based agents (claude-code, gemini): no config file to check
    if (!meta.configCheck) {
      results.push({
        name: meta.name,
        status: "warn",
        message: "Installed, but Outlit MCP not verified",
        detail: `Run \`outlit setup ${agentId}\` to configure`,
      })
      continue
    }

    // Config-file agents (cursor, claude-desktop, vscode): check for outlit key
    const { path, key } = meta.configCheck
    if (!existsSync(path)) {
      results.push({
        name: meta.name,
        status: "warn",
        message: "Installed, but config file not found",
        detail: `Run \`outlit setup ${agentId}\` to configure`,
      })
      continue
    }
    try {
      const config = readJsonConfig(path)
      const configured = !!(config[key] as Record<string, unknown> | undefined)?.outlit
      results.push({
        name: meta.name,
        status: configured ? "pass" : "warn",
        message: configured
          ? "Installed, Outlit MCP configured"
          : "Installed, but Outlit MCP not configured",
        detail: configured ? undefined : `Run \`outlit setup ${agentId}\` to configure`,
      })
    } catch {
      results.push({
        name: meta.name,
        status: "warn",
        message: "Installed, but config file is malformed",
        detail: `Check ${path} for JSON syntax errors`,
      })
    }
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
