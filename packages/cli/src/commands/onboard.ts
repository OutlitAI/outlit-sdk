import { defineCommand } from "citty"
import { authArgs } from "../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../args/output"
import { pingApiKey } from "../lib/api"
import { runBrowserAuthFlow } from "../lib/browser-auth"
import { createClient } from "../lib/client"
import { resolveApiKey, storeApiKey } from "../lib/config"
import { errorMessage, isJsonMode, outputError, outputResult } from "../lib/output"
import { isCiEnvironment } from "../lib/tty"
import { runAgentSkillsInstall, type SetupAgentId } from "./setup/skills"

type CheckStatus = "pass" | "warn" | "fail"

interface OnboardCheck {
  name: string
  status: CheckStatus
  message: string
  runner?: string
}

interface IntegrationProviderCapability {
  setupMode?: string
  postConnectSteps?: Array<{ required?: boolean }>
}

interface IntegrationListItem {
  status?: string
}

interface OnboardIntegrationSummary {
  capabilitiesAvailable: boolean
  providerCount: number
  connectedCount: number
  errorCount: number
  setupModes: Record<string, number>
  requiredFollowUpCount: number
}

const AGENT_IDS = [
  "claude-code",
  "codex",
  "gemini",
  "droid",
  "opencode",
  "pi",
  "openclaw",
] as const satisfies readonly SetupAgentId[]

export default defineCommand({
  meta: {
    name: "onboard",
    description: [
      "Prepare this shell's coding agent to use Outlit.",
      "",
      "This command validates or bootstraps auth, installs the Outlit agent skill,",
      "checks integration setup readiness, and prints the next commands to run.",
      "",
      "Examples:",
      "  outlit onboard --agent codex --json",
      "  outlit auth login --browser --json",
      "  outlit integrations capabilities --json",
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    agent: {
      type: "string",
      description: `Coding agent to prepare (${AGENT_IDS.join(", ")})`,
    },
  },
  async run({ args }) {
    const json = !!args.json
    const agentInput = typeof args.agent === "string" ? args.agent.trim() : ""

    if (!agentInput) {
      return outputError(
        {
          message: `--agent is required. Supported agents: ${AGENT_IDS.join(", ")}`,
          code: "agent_required",
        },
        json,
      )
    }

    if (!isSetupAgentId(agentInput)) {
      return outputError(
        {
          message: `Unknown agent: "${agentInput}". Supported agents: ${AGENT_IDS.join(", ")}`,
          code: "unknown_agent",
        },
        json,
      )
    }

    const checks: OnboardCheck[] = []
    const credential = await resolveOrBootstrapCredential(args["api-key"], json, checks)

    try {
      await pingApiKey(credential.key)
      checks.push({
        name: "API key",
        status: "pass",
        message: `Authenticated via ${credential.source}`,
      })
    } catch (err) {
      return outputError(
        {
          message: `API key is invalid or expired: ${errorMessage(err, "unknown error")}`,
          code: "invalid_key",
        },
        json,
      )
    }

    const integrations = await checkIntegrationReadiness(credential.key, checks)

    const install = runAgentSkillsInstall(agentInput, json, false)
    checks.push({
      name: "Outlit skill",
      status: install.success ? "pass" : "fail",
      message: install.success
        ? `Installed for ${agentInput}`
        : (install.error ?? "Skill install failed"),
      runner: install.runner,
    })

    const status = checks.some((check) => check.status === "fail") ? "action_required" : "ready"
    const nextActions = buildNextActions()
    const result = {
      status,
      agent: agentInput,
      checks,
      integrations,
      nextActions,
    }

    if (isJsonMode(json)) {
      outputResult(result)
    } else {
      console.log(`Outlit onboarding status: ${status}`)
      for (const check of checks) console.log(`  ${check.status}: ${check.name} - ${check.message}`)
      console.log("\nNext:")
      for (const action of result.nextActions) console.log(`  ${action}`)
    }

    if (status !== "ready") process.exit(1)
  },
})

function isSetupAgentId(input: string): input is SetupAgentId {
  return (AGENT_IDS as readonly string[]).includes(input)
}

async function resolveOrBootstrapCredential(
  flagApiKey: string | undefined,
  json: boolean,
  checks: OnboardCheck[],
) {
  const credential = resolveApiKey(flagApiKey)
  if (credential) return credential

  if (isCiEnvironment()) {
    return outputError(
      {
        message:
          "No Outlit API key found. Run `outlit auth login --browser --json` or set OUTLIT_API_KEY.",
        code: "auth_required",
      },
      json,
    )
  }

  const apiKey = await runBrowserAuthFlow(json)
  try {
    storeApiKey(apiKey)
  } catch (err) {
    return outputError(
      {
        message: `Failed to store credentials: ${errorMessage(err, "unknown error")}`,
        code: "write_error",
      },
      json,
    )
  }

  checks.push({
    name: "Authentication",
    status: "pass",
    message: "Browser authorization approved",
  })

  return { key: apiKey, source: "config" as const }
}

async function checkIntegrationReadiness(
  apiKey: string,
  checks: OnboardCheck[],
): Promise<OnboardIntegrationSummary> {
  const summary: OnboardIntegrationSummary = {
    capabilitiesAvailable: false,
    providerCount: 0,
    connectedCount: 0,
    errorCount: 0,
    setupModes: {},
    requiredFollowUpCount: 0,
  }

  try {
    const client = await createClient(apiKey)
    const capabilities = (await client.callTool("outlit_integration_capabilities", {})) as {
      providers?: IntegrationProviderCapability[]
    }
    const providers = Array.isArray(capabilities.providers) ? capabilities.providers : []

    summary.capabilitiesAvailable = true
    summary.providerCount = providers.length
    summary.setupModes = providers.reduce<Record<string, number>>((acc, provider) => {
      const setupMode = provider.setupMode ?? "unknown"
      acc[setupMode] = (acc[setupMode] ?? 0) + 1
      return acc
    }, {})
    summary.requiredFollowUpCount = providers.reduce((count, provider) => {
      return (
        count + (provider.postConnectSteps ?? []).filter((step) => step.required === true).length
      )
    }, 0)

    checks.push({
      name: "Integration capabilities",
      status: "pass",
      message: `${providers.length} provider setup capabilities available`,
    })

    const integrations = (await client.callTool("outlit_list_integrations", {})) as {
      items?: IntegrationListItem[]
    }
    const items = Array.isArray(integrations.items) ? integrations.items : []
    summary.connectedCount = items.filter((item) => item.status === "connected").length
    summary.errorCount = items.filter((item) => item.status === "error").length

    checks.push({
      name: "Integrations",
      status: summary.errorCount > 0 ? "warn" : "pass",
      message:
        summary.errorCount > 0
          ? `${summary.connectedCount} connected, ${summary.errorCount} with errors`
          : `${summary.connectedCount} connected`,
    })
  } catch (err) {
    checks.push({
      name: "Integration capabilities",
      status: "warn",
      message: `Could not inspect integration readiness: ${errorMessage(err, "unknown error")}`,
    })
  }

  return summary
}

function buildNextActions(): string[] {
  return [
    "outlit doctor --json",
    "outlit integrations capabilities --json",
    "outlit integrations setup <provider> --json",
    "outlit integrations status --json",
  ]
}
