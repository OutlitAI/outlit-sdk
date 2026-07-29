import { outputError } from "./output"

export type ActivationMatchMode = "ANY" | "ALL" | "AT_LEAST"
export type ActivationWindowUnit = "hour" | "day"

export interface ActivationDefinitionInput {
  signalIds: string[]
  matchMode: ActivationMatchMode
  thresholdCount?: number
  window?: {
    value: number
    unit: ActivationWindowUnit
  }
}

export interface ActivationSignalSummary {
  id: string
  key: string
  name: string
  kind: "EVENT_MATCH" | "EVENT_PATTERN" | "EXTERNAL_RECIPE"
  archivedAt: string | null
}

export interface ActivationDefinition {
  id: string
  signalIds: string[]
  matchMode: ActivationMatchMode
  thresholdCount: number | null
  window: { value: number; unit: ActivationWindowUnit } | null
  configHash: string
  effectiveAt: string
  createdAt: string
  updatedAt: string
  signals: ActivationSignalSummary[]
}

export interface ActivationState {
  definition: ActivationDefinition | null
  compatibility: {
    legacyContactActivationEvent: string | null
    legacyBehavior: "contact_only"
    migration: "explicit_signal_definition_required"
  }
}

export interface ActivationPreviewInput {
  definition: ActivationDefinitionInput
  lookbackDays?: number
  exampleLimit?: number
}

export interface ActivationUpdateInput {
  definition: ActivationDefinitionInput | null
}

export interface ActivationPreviewExample {
  customer: {
    id: string
    name: string
    domain: string
  }
  activatedAt: string | null
  matchedAt: string
  contributingOccurrences: Array<{
    id: string
    signalId: string
    occurredAt: string
  }>
}

export interface ActivationPreviewResult {
  evaluatedFrom: string
  evaluatedTo: string
  evaluatedOccurrenceCount: number
  matchedCustomerCount: number
  alreadyActivatedCustomerCount: number
  wouldActivateCustomerCount: number
  truncated: boolean
  examples: ActivationPreviewExample[]
}

export interface PlatformCommandSuccess<TData> {
  ok: true
  commandId: string
  commandVersion: number
  correlationId: string
  result: {
    operationId: string
    status: "completed"
    resources: Array<{ type: string; id: string }>
    data: TData
    warnings: string[]
    auditId?: string
  }
}

export type ActivationGetResponse = PlatformCommandSuccess<{ activation: ActivationState }>
export type ActivationPreviewResponse = PlatformCommandSuccess<{
  preview: ActivationPreviewResult
}>
export type ActivationUpdateResponse = PlatformCommandSuccess<{
  activation: ActivationState
  changed: boolean
}>

export interface ActivationDefinitionArgs {
  signal?: string
  signals?: string
  match?: string
  threshold?: string | number
  window?: string
}

export interface ActivationPreviewArgs {
  "lookback-days"?: string | number
  "example-limit"?: string | number
}

export const activationDefinitionArgs = {
  signal: {
    type: "string",
    description: "One customer-grain signal UUID (ergonomic single-signal form)",
  },
  signals: {
    type: "string",
    description: "Comma-separated customer-grain signal UUIDs (one to three unique signals)",
  },
  match: {
    type: "string",
    description: "Signal composition mode (ANY, ALL, or AT_LEAST)",
  },
  threshold: {
    type: "string",
    description: "Required match count for AT_LEAST (two through the signal count)",
  },
  window: {
    type: "string",
    description: "Optional ALL/AT_LEAST window (for example 168h or 30d)",
  },
} as const

export const activationPreviewArgs = {
  "lookback-days": {
    type: "string",
    description: "Historical preview lookback in days (1-90; Core default: 30)",
  },
  "example-limit": {
    type: "string",
    description: "Maximum historical customer examples (1-20; Core default: 10)",
  },
} as const

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function invalid(message: string, json: boolean): never {
  return outputError({ message, code: "invalid_input" }, json)
}

function missing(message: string, json: boolean): never {
  return outputError({ message, code: "missing_input" }, json)
}

function parseBoundedInteger(
  value: string | number | undefined,
  flag: string,
  minimum: number,
  maximum: number,
  json: boolean,
): number | undefined {
  if (value === undefined) return undefined

  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return invalid(`${flag} must be an integer from ${minimum} to ${maximum}`, json)
  }

  return parsed
}

function parseWindow(
  value: string | undefined,
  json: boolean,
): ActivationDefinitionInput["window"] {
  if (value === undefined) return undefined

  const match = /^(\d+)(h|d)$/i.exec(value.trim())
  if (!match) {
    return invalid("--window must use a whole number followed by h or d", json)
  }

  const amount = Number(match[1])
  const suffix = match[2]?.toLowerCase()
  const maximum = suffix === "h" ? 168 : 90
  if (!Number.isInteger(amount) || amount < 1 || amount > maximum) {
    return invalid(`--window must be between 1 and ${maximum}${suffix === "h" ? "h" : "d"}`, json)
  }

  return {
    value: amount,
    unit: suffix === "h" ? "hour" : "day",
  }
}

export function parseActivationDefinition(
  args: ActivationDefinitionArgs,
  json: boolean,
): ActivationDefinitionInput {
  const singleSignal = args.signal?.trim()
  const signalsValue = args.signals?.trim()

  if (args.signal !== undefined && args.signals !== undefined) {
    return invalid("Use either --signal or --signals, not both", json)
  }

  const rawSignalIds = singleSignal
    ? [singleSignal]
    : (signalsValue ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
  const signalIds = [...new Set(rawSignalIds)]

  if (signalIds.length === 0) {
    return missing("Provide --signal or --signals", json)
  }
  if (signalIds.length > 3) {
    return invalid("Activation definitions support one to three unique signals", json)
  }

  const invalidSignalIds = signalIds.filter((signalId) => !UUID_REGEX.test(signalId))
  if (invalidSignalIds.length > 0) {
    return invalid(`Signal IDs must be UUIDs: ${invalidSignalIds.join(", ")}`, json)
  }

  const normalizedMatch = args.match?.trim().toUpperCase()
  if (signalIds.length > 1 && !normalizedMatch) {
    return missing("Provide --match ANY, ALL, or AT_LEAST for multiple signals", json)
  }
  if (
    normalizedMatch &&
    normalizedMatch !== "ANY" &&
    normalizedMatch !== "ALL" &&
    normalizedMatch !== "AT_LEAST"
  ) {
    return invalid("--match must be ANY, ALL, or AT_LEAST", json)
  }

  const matchMode = (normalizedMatch ?? "ANY") as ActivationMatchMode
  const window = parseWindow(args.window, json)
  const thresholdCount =
    args.threshold === undefined
      ? undefined
      : parseBoundedInteger(args.threshold, "--threshold", 1, 3, json)

  if (signalIds.length === 1) {
    if (matchMode !== "ANY" || thresholdCount !== undefined || window !== undefined) {
      return invalid(
        "A single-signal definition must use ANY without --threshold or --window",
        json,
      )
    }
  } else if (matchMode === "ANY") {
    if (thresholdCount !== undefined || window !== undefined) {
      return invalid("ANY does not accept --threshold or --window", json)
    }
  } else if (matchMode === "ALL") {
    if (thresholdCount !== undefined) {
      return invalid("ALL does not accept --threshold", json)
    }
  } else {
    if (thresholdCount === undefined) {
      return missing("AT_LEAST requires --threshold", json)
    }
    if (thresholdCount < 2 || thresholdCount > signalIds.length) {
      return invalid(`--threshold must be from 2 to the signal count (${signalIds.length})`, json)
    }
  }

  return {
    signalIds,
    matchMode,
    ...(thresholdCount === undefined ? {} : { thresholdCount }),
    ...(window === undefined ? {} : { window }),
  }
}

export function parseActivationPreviewOptions(
  args: ActivationPreviewArgs,
  json: boolean,
): Omit<ActivationPreviewInput, "definition"> {
  const lookbackDays = parseBoundedInteger(args["lookback-days"], "--lookback-days", 1, 90, json)
  const exampleLimit = parseBoundedInteger(args["example-limit"], "--example-limit", 1, 20, json)

  return {
    ...(lookbackDays === undefined ? {} : { lookbackDays }),
    ...(exampleLimit === undefined ? {} : { exampleLimit }),
  }
}
