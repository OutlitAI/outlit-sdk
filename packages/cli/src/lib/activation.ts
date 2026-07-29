import { outputError } from "./output"

export interface ActivationPreviewInput {
  eventName: string
  lookbackDays?: number
  exampleLimit?: number
}

export interface ActivationUpdateInput {
  eventName: string | null
}

export interface ActivationEventArgs {
  event?: string
}

export interface ActivationPreviewArgs {
  "lookback-days"?: string | number
  "example-limit"?: string | number
}

export const activationEventArg = {
  event: {
    type: "string",
    description: "Exact ordinary product event name (1-191 characters)",
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

export function parseActivationEvent(args: ActivationEventArgs, json: boolean): string {
  const eventName = args.event?.trim()
  if (!eventName) {
    return missing("Provide --event", json)
  }
  if (eventName.length > 191) {
    return invalid("--event must be at most 191 characters", json)
  }

  return eventName
}

export function parseActivationPreviewOptions(
  args: ActivationPreviewArgs,
  json: boolean,
): Omit<ActivationPreviewInput, "eventName"> {
  const lookbackDays = parseBoundedInteger(args["lookback-days"], "--lookback-days", 1, 90, json)
  const exampleLimit = parseBoundedInteger(args["example-limit"], "--example-limit", 1, 20, json)

  return {
    ...(lookbackDays === undefined ? {} : { lookbackDays }),
    ...(exampleLimit === undefined ? {} : { exampleLimit }),
  }
}
