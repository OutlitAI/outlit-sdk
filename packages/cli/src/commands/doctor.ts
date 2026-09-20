import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { isOutlitToolsApiError } from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { outputArgs } from "../args/output"
import {
  type ApiKeyValidationPayload,
  isApiKeyValidationUnavailableError,
  pingApiKey,
} from "../lib/api"
import { createClient } from "../lib/client"
import type { CredentialResult } from "../lib/config"
import { CLI_VERSION, maskKey, OUTLIT_DASHBOARD_URL, resolveApiKey, TICK } from "../lib/config"
import { errorMessage, isJsonMode, outputResult } from "../lib/output"
import { isUnicodeSupported } from "../lib/tty"
import { fetchLatestCliVersion, formatUpdateCommand } from "../lib/update"
import { type AgentId, detectAgents as detectInstalledAgents } from "./setup/index"

type Status = "pass" | "warn" | "fail"
export interface CheckResult {
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
      "Runs six checks in sequence:",
      "  1. CLI version -- compares against npm registry",
      "  2. API key -- checks presence and format (ok_ prefix)",
      "  3. API validation -- makes a live test call to verify the key works",
      "  4. Permissions -- shows key grants and unavailable commands",
      "  5. Integrations -- checks integration readiness or explains missing access",
      "  6. Agent detection -- detects supported coding agents and whether the Outlit skill is installed",
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
      checks.push(apiCheck.check)

      if (apiCheck.validation) {
        checks.push(checkPermissions(apiCheck.validation))
      }
      if (apiCheck.check.status !== "fail") {
        checks.push(await checkIntegrations(credential.key, apiCheck.validation))
      }
    } else {
      checks.push({
        name: "API validation",
        status: "fail",
        message: "Skipped -- no API key found",
      })
    }

    checks.push(...buildAgentChecks())

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

async function validateApiKey(apiKey: string): Promise<{
  check: CheckResult
  validation: ApiKeyValidationPayload | null
}> {
  try {
    const validation = await pingApiKey(apiKey)
    const org =
      validation.organization?.name ?? validation.organization?.slug ?? validation.organizationId
    const keyDetail = validation.apiKey
      ? ` · key "${validation.apiKey.name}" (${validation.apiKey.keyType})`
      : ""
    return {
      check: {
        name: "API validation",
        status: "pass",
        message: "Key is valid",
        detail: `Org: ${org}${keyDetail}`,
      },
      validation,
    }
  } catch (err) {
    if (isApiKeyValidationUnavailableError(err)) {
      return {
        check: {
          name: "API validation",
          status: "warn",
          message: "API validation is temporarily unavailable",
          detail: "Try again shortly",
        },
        validation: null,
      }
    }

    return {
      check: {
        name: "API validation",
        status: "fail",
        message: `API rejected key: ${errorMessage(err, "unknown error")}`,
        detail: `Check your key at ${OUTLIT_DASHBOARD_URL}`,
      },
      validation: null,
    }
  }
}

type ApiKeyGrant = ApiKeyValidationPayload["authorization"]["grants"][number]

/**
 * CLI command families and the API key grants that permit them. Mirrors Core's
 * enforcement (apiKeyHasGrant / requiredApiKeyGrant); informational only — the
 * gateway remains the authority and runtime visibility may still differ.
 */
const COMMAND_GRANTS: ReadonlyArray<{
  commands: string
  anyOf: readonly ApiKeyGrant[]
}> = [
  {
    commands: "customers (read), users, facts, sources, search, attention",
    anyOf: ["customer_intelligence:read"],
  },
  { commands: "ws-users", anyOf: ["workspace_members:read"] },
  { commands: "sql, schema", anyOf: ["analytics:read"] },
  { commands: "destinations", anyOf: ["destinations:manage"] },
  { commands: "features", anyOf: ["behavior_metrics:manage"] },
  {
    commands: "integrations",
    anyOf: ["integrations:manage", "integrations:connect_own"],
  },
  // Read and manage grants are independent: Core enforces them per operation,
  // so a manage-only key still cannot use the read subcommands.
  { commands: "activation get, preview", anyOf: ["activation:read"] },
  { commands: "activation update, disable", anyOf: ["activation:manage"] },
  { commands: "settings get", anyOf: ["workspace_settings:read"] },
  { commands: "settings update", anyOf: ["workspace_settings:manage"] },
  { commands: "customers grant, revoke, owner", anyOf: ["customer_access:manage"] },
  {
    commands: "identity suggestions list",
    anyOf: ["customer_intelligence:read"],
  },
  {
    commands: "identity suggestions reject",
    anyOf: ["customer_identity:review"],
  },
  {
    commands: "customers merge (preview), customers merge-status",
    anyOf: ["customer_intelligence:read"],
  },
  { commands: "customers merge --execute", anyOf: ["customer_identity:merge"] },
]

function grantUsable(
  grant: ApiKeyGrant,
  grants: readonly ApiKeyGrant[],
  createdById: string | null,
): boolean {
  if (!grants.includes(grant)) return false
  // Core scopes connect_own authority to keys bound to their creator.
  if (grant === "integrations:connect_own" && !createdById) return false
  return true
}

function checkPermissions(validation: ApiKeyValidationPayload): CheckResult {
  const grants = validation.authorization.grants
  const createdById = validation.createdById?.trim() || null
  const unavailable = COMMAND_GRANTS.filter(
    (family) => !family.anyOf.some((grant) => grantUsable(grant, grants, createdById)),
  )

  const detail = [
    grants.length > 0 ? `grants: ${grants.join(", ")}` : null,
    unavailable.length > 0
      ? `unavailable to this key: ${unavailable.map((family) => family.commands).join("; ")}`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ")

  return {
    name: "Permissions",
    status: unavailable.length > 0 ? "warn" : "pass",
    message: `${grants.length} key grant${grants.length === 1 ? "" : "s"}`,
    detail: detail || undefined,
  }
}

async function checkIntegrations(
  apiKey: string,
  validation: ApiKeyValidationPayload | null,
): Promise<CheckResult> {
  // When validation succeeded, skip the call entirely if the key provably
  // lacks integrations access — a guaranteed denial adds no information.
  const grants = validation?.authorization.grants
  if (grants) {
    const createdById = validation?.createdById?.trim() || null
    const canRead =
      grantUsable("integrations:manage", grants, createdById) ||
      grantUsable("integrations:connect_own", grants, createdById)
    if (!canRead) {
      return {
        name: "Integrations",
        status: "warn",
        message: "API key does not grant integrations access",
        detail:
          "Requires the integrations:manage grant, or integrations:connect_own on a user-created key",
      }
    }
  }

  try {
    const client = await createClient(apiKey)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Integrations check timed out")), 10_000),
    )
    const data = (await Promise.race([
      client.callTool("outlit_get_integration_status", {}),
      timeout,
    ])) as {
      integrations?: Array<{ status: string }>
    }
    const items = data.integrations ?? []
    const ready = items.filter((item) => item.status === "ready").length
    const requiringIntervention = items.filter(
      (item) => item.status === "requires_intervention",
    ).length

    if (requiringIntervention > 0) {
      return {
        name: "Integrations",
        status: "warn",
        message: `${ready} ready, ${requiringIntervention} requiring intervention`,
        detail: "Run `outlit integrations status` for details",
      }
    }
    if (ready === 0) {
      return {
        name: "Integrations",
        status: "pass",
        message: "No integrations ready",
        detail: "Run `outlit integrations status` to inspect integrations",
      }
    }
    return {
      name: "Integrations",
      status: "pass",
      message: `${ready} integration(s) ready`,
    }
  } catch (err) {
    if (isOutlitToolsApiError(err) && err.envelope?.code === "TOOL_CALL_FORBIDDEN") {
      return {
        name: "Integrations",
        status: "warn",
        message: "API key was denied integrations access",
        detail:
          "Requires the integrations:manage grant, or integrations:connect_own on a user-created key",
      }
    }
    return {
      name: "Integrations",
      status: "warn",
      message: "Could not check integrations",
      detail: "Integration readiness may not be available yet",
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
    missingDetail: "Run `outlit setup openclaw` to install the Outlit skill",
  },
}

interface AgentCheckOptions {
  claudeConfigDir?: string
  homeDir?: string
}

function getHomeDir(options?: AgentCheckOptions): string {
  return options?.homeDir?.trim() || process.env.HOME?.trim() || homedir()
}

function getSharedSkillsDir(options?: AgentCheckOptions): string {
  return join(getHomeDir(options), ".agents", "skills")
}

function getOpenClawHome(options?: AgentCheckOptions): string {
  const home = getHomeDir(options)

  if (existsSync(join(home, ".openclaw"))) return join(home, ".openclaw")
  if (existsSync(join(home, ".clawdbot"))) return join(home, ".clawdbot")
  if (existsSync(join(home, ".moltbot"))) return join(home, ".moltbot")

  return join(home, ".openclaw")
}

function getAgentSkillDir(agentId: AgentId, options?: AgentCheckOptions): string {
  const home = getHomeDir(options)

  switch (agentId) {
    case "claude-code":
      return join(
        options?.claudeConfigDir?.trim() ||
          process.env.CLAUDE_CONFIG_DIR?.trim() ||
          join(home, ".claude"),
        "skills",
      )
    case "codex":
      return getSharedSkillsDir(options)
    case "gemini":
      return getSharedSkillsDir(options)
    case "droid":
      return join(home, ".factory", "skills")
    case "opencode":
      return getSharedSkillsDir(options)
    case "pi":
      return join(home, ".pi", "agent", "skills")
    case "openclaw":
      return join(getOpenClawHome(options), "skills")
  }
}

export function buildAgentChecks(
  detected: AgentId[] = detectInstalledAgents(),
  options?: AgentCheckOptions,
): CheckResult[] {
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
    const hasSkill = existsSync(join(getAgentSkillDir(agentId, options), "outlit", "SKILL.md"))

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
