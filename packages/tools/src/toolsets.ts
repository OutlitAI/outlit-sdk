import { type CustomerToolName, customerToolNames } from "./contracts.js"

export const sqlToolNames = [
  "outlit_schema",
  "outlit_query",
] as const satisfies readonly CustomerToolName[]

const sqlToolNameSet = new Set<CustomerToolName>(sqlToolNames)

export const defaultAgentToolNames = customerToolNames.filter(
  (toolName) => !sqlToolNameSet.has(toolName),
)

export const analyticalAgentToolNames = customerToolNames

export const allCustomerToolNames = customerToolNames
