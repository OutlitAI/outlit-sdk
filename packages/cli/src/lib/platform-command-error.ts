export interface PlatformCommandErrorEnvelope {
  ok: false
  commandId: string
  commandVersion: number
  error: {
    code: string
    message: string
    correlationId: string
    retryable: boolean
    details?: unknown
  }
}

export type PlatformCommandError = Error & {
  status: number
  commandEnvelope: PlatformCommandErrorEnvelope
}

export function createPlatformCommandError(
  status: number,
  commandEnvelope: PlatformCommandErrorEnvelope,
): PlatformCommandError {
  const error = new Error(commandEnvelope.error.message) as PlatformCommandError
  error.name = "PlatformCommandError"
  error.status = status
  error.commandEnvelope = commandEnvelope
  return error
}

export function isPlatformCommandError(error: unknown): error is PlatformCommandError {
  return (
    error instanceof Error &&
    isRecord((error as Partial<PlatformCommandError>).commandEnvelope) &&
    isCommandErrorEnvelope((error as Partial<PlatformCommandError>).commandEnvelope)
  )
}

export function isCommandErrorEnvelope(payload: unknown): payload is PlatformCommandErrorEnvelope {
  if (!isRecord(payload) || payload.ok !== false) return false
  if (typeof payload.commandId !== "string") return false
  if (typeof payload.commandVersion !== "number") return false
  if (!isRecord(payload.error)) return false

  return (
    typeof payload.error.code === "string" &&
    typeof payload.error.message === "string" &&
    typeof payload.error.correlationId === "string" &&
    typeof payload.error.retryable === "boolean"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
