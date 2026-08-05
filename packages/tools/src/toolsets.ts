import { consumerToolPolicies, publicToolNames } from "./generated/contracts.js"

export const defaultToolNames = consumerToolPolicies.default
export const analyticalToolNames = consumerToolPolicies.analytical
export const cliToolNames = consumerToolPolicies.cli
export const allPublicToolNames = publicToolNames
export type CliToolName = (typeof cliToolNames)[number]

const defaultToolNameSet = new Set<string>(defaultToolNames)
export const sqlToolNames = analyticalToolNames.filter(
  (toolName) => !defaultToolNameSet.has(toolName),
)
