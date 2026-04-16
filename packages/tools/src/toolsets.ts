import { type CustomerToolName, customerToolNames } from "./contracts.js"

export const actionToolNames = [
  "outlit_send_notification",
] as const satisfies readonly CustomerToolName[]

export const defaultAgentToolNames = [
  "outlit_list_customers",
  "outlit_list_users",
  "outlit_get_customer",
  "outlit_get_timeline",
  "outlit_list_facts",
  "outlit_get_fact",
  "outlit_get_source",
  "outlit_search_customer_context",
  ...actionToolNames,
] as const satisfies readonly CustomerToolName[]

export const sqlToolNames = [
  "outlit_schema",
  "outlit_query",
] as const satisfies readonly CustomerToolName[]

export const analyticalAgentToolNames = [
  ...defaultAgentToolNames,
  ...sqlToolNames,
] as const satisfies readonly CustomerToolName[]

export const allCustomerToolNames = customerToolNames
