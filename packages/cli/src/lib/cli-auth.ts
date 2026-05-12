import { CLI_VERSION, DEFAULT_API_URL } from "./config"
import { type PollOptions, pollUntil } from "./poll"

export interface CliAuthStartResponse {
  requestId: string
  pollToken: string
  userCode: string
  approveUrl: string
  expiresAt: string
  intervalSeconds: number
}

export type CliAuthPollResponse =
  | {
      status: "pending"
      userCode?: string
      expiresAt?: string
      intervalSeconds?: number
    }
  | {
      status: "approved"
      apiKey: string
      keyPrefix: string
    }
  | { status: "failed"; error?: string }
  | { status: "consumed" | "expired" | "invalid" }

type JsonObject = Record<string, unknown>

function buildApiUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString()
}

function asObject(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid response from Outlit API")
  }

  return value as JsonObject
}

async function readJsonObject(response: Response): Promise<JsonObject> {
  const text = await response.text()
  const parsed = text
    ? (() => {
        try {
          return JSON.parse(text) as unknown
        } catch {
          throw new Error(text)
        }
      })()
    : {}

  return asObject(parsed)
}

function errorFromPayload(payload: JsonObject, fallback: string): string {
  return typeof payload.error === "string" ? payload.error : fallback
}

export async function startCliAuthRequest(
  baseUrl = process.env.OUTLIT_API_URL ?? DEFAULT_API_URL,
): Promise<CliAuthStartResponse> {
  const response = await globalThis.fetch(buildApiUrl(baseUrl, "/api/cli-auth/start"), {
    method: "POST",
    headers: {
      "User-Agent": `outlit-cli/${CLI_VERSION}`,
    },
  })
  const payload = await readJsonObject(response)

  if (!response.ok) {
    throw new Error(errorFromPayload(payload, `CLI auth start failed (${response.status})`))
  }

  if (
    typeof payload.requestId !== "string" ||
    typeof payload.pollToken !== "string" ||
    typeof payload.userCode !== "string" ||
    typeof payload.approveUrl !== "string" ||
    typeof payload.expiresAt !== "string" ||
    typeof payload.intervalSeconds !== "number"
  ) {
    throw new Error("Invalid CLI auth start response from Outlit API")
  }

  return {
    requestId: payload.requestId,
    pollToken: payload.pollToken,
    userCode: payload.userCode,
    approveUrl: payload.approveUrl,
    expiresAt: payload.expiresAt,
    intervalSeconds: payload.intervalSeconds,
  }
}

export async function pollCliAuthRequest(
  baseUrl: string,
  input: {
    requestId: string
    pollToken: string
  },
): Promise<CliAuthPollResponse> {
  const response = await globalThis.fetch(buildApiUrl(baseUrl, "/api/cli-auth/poll"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `outlit-cli/${CLI_VERSION}`,
    },
    body: JSON.stringify(input),
  })
  const payload = await readJsonObject(response)

  if (payload.status === "invalid") {
    return { status: "invalid" }
  }

  if (!response.ok) {
    throw new Error(errorFromPayload(payload, `CLI auth poll failed (${response.status})`))
  }

  if (payload.status === "approved") {
    if (typeof payload.apiKey !== "string" || typeof payload.keyPrefix !== "string") {
      throw new Error("Invalid approved CLI auth response from Outlit API")
    }

    return {
      status: "approved",
      apiKey: payload.apiKey,
      keyPrefix: payload.keyPrefix,
    }
  }

  if (
    payload.status === "pending" ||
    payload.status === "failed" ||
    payload.status === "consumed" ||
    payload.status === "expired" ||
    payload.status === "invalid"
  ) {
    return payload as CliAuthPollResponse
  }

  throw new Error("Invalid CLI auth poll response from Outlit API")
}

export async function waitForCliAuthApproval(
  baseUrl: string,
  request: Pick<CliAuthStartResponse, "requestId" | "pollToken" | "expiresAt" | "intervalSeconds">,
  opts: PollOptions = {},
): Promise<CliAuthPollResponse | null> {
  const expiresAtMs = new Date(request.expiresAt).getTime()
  const timeoutMs = opts.timeoutMs ?? Math.max(1_000, expiresAtMs - Date.now())
  const intervalMs = opts.intervalMs ?? request.intervalSeconds * 1_000

  return pollUntil(
    () =>
      pollCliAuthRequest(baseUrl, {
        requestId: request.requestId,
        pollToken: request.pollToken,
      }),
    (result) => result.status !== "pending",
    {
      ...opts,
      intervalMs,
      timeoutMs,
    },
  )
}
