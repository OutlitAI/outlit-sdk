import type { PublicToolName } from "./contracts.js"
import {
  consumerToolPolicies,
  publicToolContracts,
  publicToolNames,
} from "./generated/contracts.js"

export const defaultToolNames = consumerToolPolicies.default
export const analyticalToolNames = consumerToolPolicies.analytical
export const piToolNames = consumerToolPolicies.pi
export const cliToolNames = consumerToolPolicies.cli
export const allPublicToolNames = publicToolNames
export type CliToolName = (typeof cliToolNames)[number]
export type PiToolName = (typeof piToolNames)[number]

const defaultToolNameSet = new Set<string>(defaultToolNames)
export const sqlToolNames = analyticalToolNames.filter(
  (toolName) => !defaultToolNameSet.has(toolName),
)

/** Core's named groups of tools, in the order outlit_list_toolsets presents them. */
export const toolsetNames =
  publicToolContracts.outlit_load_toolset.inputSchema.properties.toolset.enum
export type ToolsetName = (typeof toolsetNames)[number]

/** The toolset a tool belongs to. */
export function getToolset(toolName: PublicToolName): ToolsetName {
  return publicToolContracts[toolName].toolset
}

/** The public tools in the given toolsets, in contract order. */
export function toolNamesInToolsets(toolsets: readonly ToolsetName[]): PublicToolName[] {
  const wanted = new Set<string>(toolsets)
  return publicToolNames.filter((toolName) => wanted.has(getToolset(toolName)))
}
