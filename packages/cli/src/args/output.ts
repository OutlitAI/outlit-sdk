import type { ArgsDef } from "citty"

export const AGENT_JSON_HINT = "For AI agents: output is JSON automatically when stdout is piped."

export const outputArgs = {
  json: {
    type: "boolean",
    description:
      "Force JSON output.\nNote: JSON is also auto-enabled when stdout is piped (e.g. in CI, scripts, or AI agent contexts).",
  },
  verbose: {
    type: "boolean",
    description:
      "Print each call's request ID and API version to stderr (quote the request ID in a bug report).",
  },
} satisfies ArgsDef
