export type JsonSchema = {
  readonly [key: string]: unknown
}

export const customerToolNames = [
  "outlit_list_customers",
  "outlit_list_users",
  "outlit_get_customer",
  "outlit_get_timeline",
  "outlit_list_facts",
  "outlit_get_fact",
  "outlit_get_source",
  "outlit_search_customer_context",
  "outlit_query",
  "outlit_schema",
] as const

export const customerToolContracts = {
  outlit_list_customers: {
    toolName: "outlit_list_customers",
    description:
      "Browse and filter customers. Use this to find customers by billing status, activity recency, revenue, or name. Returns a paginated list with summary info (MRR, last activity, status).",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        billingStatus: {
          description: "Filter by billing status",
          type: "string",
          enum: ["NONE", "TRIALING", "PAYING", "PAST_DUE", "CHURNED"],
        },
        hasActivityInLast: {
          description: "Filter customers with activity in the last N days",
          type: "string",
          enum: ["7d", "14d", "30d", "90d"],
        },
        noActivityInLast: {
          description: "Filter customers with NO activity in the last N days",
          type: "string",
          enum: ["7d", "14d", "30d", "90d"],
        },
        mrrAbove: {
          description: "Minimum MRR in cents (e.g., 10000 = $100)",
          type: "number",
          minimum: 0,
        },
        mrrBelow: {
          description: "Maximum MRR in cents",
          type: "number",
          minimum: 0,
        },
        traitFilters: {
          description: "Filter by exact trait values using key/value pairs",
          type: "object",
          propertyNames: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,100}$",
          },
          additionalProperties: {
            anyOf: [
              {
                type: "string",
                maxLength: 500,
              },
              {
                type: "number",
              },
              {
                type: "boolean",
              },
            ],
          },
        },
        search: {
          description: "Search by customer name or domain (case-insensitive)",
          type: "string",
          maxLength: 500,
        },
        limit: {
          description: "Results per page (max 1000)",
          default: 50,
          type: "number",
          minimum: 1,
          maximum: 1000,
        },
        cursor: {
          description: "Pagination cursor from previous response",
          type: "string",
        },
        orderBy: {
          description: "Field to order results by",
          default: "last_activity_at",
          type: "string",
          enum: ["last_activity_at", "first_seen_at", "name", "mrr_cents"],
        },
        orderDirection: {
          description: "Sort direction",
          default: "desc",
          type: "string",
          enum: ["asc", "desc"],
        },
      },
      additionalProperties: false,
    },
  },
  outlit_list_users: {
    toolName: "outlit_list_users",
    description:
      "Browse and filter users. Use this to find users by journey stage, activity recency, customer, or email/name. Returns a paginated list with activity info.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        journeyStage: {
          description: "Filter by user journey stage",
          type: "string",
          enum: ["DISCOVERED", "SIGNED_UP", "ACTIVATED", "ENGAGED", "INACTIVE"],
        },
        customerId: {
          description: "Filter users by customer ID",
          type: "string",
          maxLength: 500,
        },
        traitFilters: {
          description: "Filter by exact trait values using key/value pairs",
          type: "object",
          propertyNames: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{1,100}$",
          },
          additionalProperties: {
            anyOf: [
              {
                type: "string",
                maxLength: 500,
              },
              {
                type: "number",
              },
              {
                type: "boolean",
              },
            ],
          },
        },
        hasActivityInLast: {
          description:
            "Filter users active within this window. Format: Nd, Nh, or Nm (e.g., '7d', '24h', '90m')",
          type: "string",
          pattern: "^\\d+(d|h|m)$",
        },
        noActivityInLast: {
          description:
            "Filter users NOT active within this window. Format: Nd, Nh, or Nm (e.g., '30d', '2h')",
          type: "string",
          pattern: "^\\d+(d|h|m)$",
        },
        search: {
          description: "Search by user email or name (case-insensitive)",
          type: "string",
          maxLength: 500,
        },
        limit: {
          description: "Results per page (max 1000)",
          default: 50,
          type: "number",
          minimum: 1,
          maximum: 1000,
        },
        cursor: {
          description: "Pagination cursor from previous response",
          type: "string",
        },
        orderBy: {
          description: "Field to order by",
          default: "last_activity_at",
          type: "string",
          enum: ["last_activity_at", "first_seen_at", "email"],
        },
        orderDirection: {
          description: "Sort direction",
          default: "desc",
          type: "string",
          enum: ["asc", "desc"],
        },
      },
      additionalProperties: false,
    },
  },
  outlit_get_customer: {
    toolName: "outlit_get_customer",
    description:
      "Get full details for a single customer. Use this when you already know which customer you want to inspect. Optionally include related data (users, revenue, recent activity, engagement metrics).",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        customer: {
          type: "string",
          description: "Customer ID, domain, or name to look up",
        },
        include: {
          description: "Additional data sections to include in the response",
          type: "array",
          items: {
            type: "string",
            enum: ["users", "revenue", "recentTimeline", "behaviorMetrics"],
          },
        },
        timeframe: {
          description: "Timeframe for timeline and behavior metrics (default: 30d)",
          default: "30d",
          type: "string",
          enum: ["7d", "14d", "30d", "90d"],
        },
      },
      required: ["customer"],
      additionalProperties: false,
    },
  },
  outlit_get_timeline: {
    toolName: "outlit_get_timeline",
    description:
      "Get the chronological activity timeline for a customer. Use this to see what happened and when — emails, calls, Slack messages, billing events, etc. Supports channel and date filtering.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        customer: {
          type: "string",
          description: "Customer ID or domain",
        },
        channels: {
          description: "Filter by event channel (e.g., EMAIL, SLACK, CALL)",
          type: "array",
          items: {
            type: "string",
            enum: ["SDK", "EMAIL", "SLACK", "CALL", "CRM", "BILLING", "SUPPORT", "INTERNAL"],
          },
        },
        eventTypes: {
          description: "Filter by event type",
          type: "array",
          items: {
            type: "string",
          },
        },
        timeframe: {
          description:
            "Relative time window (default: 30d). Cannot be used with startDate/endDate.",
          type: "string",
          enum: ["7d", "14d", "30d", "90d", "all"],
        },
        startDate: {
          description:
            "Start of time window (ISO 8601, e.g. '2025-01-01T00:00:00Z'). Cannot be used with timeframe.",
          type: "string",
          format: "date-time",
          pattern:
            "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
        },
        endDate: {
          description:
            "End of time window (ISO 8601, e.g. '2025-01-31T23:59:59Z'). Cannot be used with timeframe.",
          type: "string",
          format: "date-time",
          pattern:
            "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
        },
        limit: {
          description: "Results per page (max 1000)",
          default: 50,
          type: "number",
          minimum: 1,
          maximum: 1000,
        },
        cursor: {
          description: "Pagination cursor from previous response",
          type: "string",
        },
      },
      required: ["customer"],
      additionalProperties: false,
    },
  },
  outlit_list_facts: {
    toolName: "outlit_list_facts",
    description:
      "List structured facts known about a customer. Use filters like status, sourceTypes, and date bounds to narrow the result set. For topic-specific retrieval, use outlit_search_customer_context instead.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        customer: {
          type: "string",
          description: "Customer ID or domain",
        },
        status: {
          description: "Optional fact status filter",
          type: "array",
          items: {
            type: "string",
            enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED", "SNOOZED", "CANDIDATE"],
          },
        },
        sourceTypes: {
          description: "Optional generic source types to restrict fact results to.",
          type: "array",
          items: {
            type: "string",
            enum: ["EMAIL", "CALL", "CALENDAR_EVENT", "SUPPORT_TICKET"],
          },
        },
        after: {
          description: "ISO 8601 datetime lower bound",
          type: "string",
          format: "date-time",
          pattern:
            "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
        },
        before: {
          description: "ISO 8601 datetime upper bound",
          type: "string",
          format: "date-time",
          pattern:
            "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
        },
        limit: {
          description: "Results per page (max 100)",
          default: 50,
          type: "number",
          minimum: 1,
          maximum: 100,
        },
        cursor: {
          description: "Pagination cursor from previous response",
          type: "string",
        },
      },
      required: ["customer"],
      additionalProperties: false,
    },
  },
  outlit_get_fact: {
    toolName: "outlit_get_fact",
    description:
      "Get one exact fact by ID. Returns the canonical fact shape and optionally expands requested related data such as evidence.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        factId: {
          type: "string",
          minLength: 1,
          maxLength: 500,
          description: "Exact fact ID to retrieve",
        },
        include: {
          description:
            "Optional best-effort expansions. Use include=['evidence'] to request evidence when available; unsupported include values are ignored.",
          type: "array",
          items: {
            type: "string",
            minLength: 1,
            maxLength: 100,
          },
        },
      },
      required: ["factId"],
      additionalProperties: false,
    },
  },
  outlit_get_source: {
    toolName: "outlit_get_source",
    description:
      "Get one exact source record by generic sourceType and sourceId. Use this when you already know the concrete underlying source you want to inspect.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        sourceType: {
          type: "string",
          enum: ["EMAIL", "CALL", "CALENDAR_EVENT", "SUPPORT_TICKET"],
        },
        sourceId: {
          type: "string",
          minLength: 1,
          maxLength: 500,
        },
      },
      required: ["sourceType", "sourceId"],
      additionalProperties: false,
    },
  },
  outlit_search_customer_context: {
    toolName: "outlit_search_customer_context",
    description:
      "Search across all known customer context using a natural-language query. Returns grouped artifact-level results for matching sources and facts. Omit customer to search across all customers in the organization.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        customer: {
          description: "Customer ID, domain, or name. Omit to search across all customers.",
          anyOf: [
            {
              type: "string",
              minLength: 1,
              maxLength: 500,
            },
            {
              type: "null",
            },
          ],
        },
        query: {
          type: "string",
          minLength: 2,
          maxLength: 2000,
          description: "Natural language query or topic to search for.",
        },
        topK: {
          description: "Maximum number of artifact results to return (default 20).",
          type: "integer",
          minimum: 1,
          maximum: 50,
        },
        after: {
          description: "ISO 8601 datetime lower bound",
          type: "string",
          format: "date-time",
          pattern:
            "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
        },
        before: {
          description: "ISO 8601 datetime upper bound",
          type: "string",
          format: "date-time",
          pattern:
            "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
        },
        sourceTypes: {
          description: "Optional generic source types to restrict the search to.",
          type: "array",
          items: {
            type: "string",
            enum: ["EMAIL", "CALL", "CALENDAR_EVENT", "SUPPORT_TICKET"],
          },
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  outlit_query: {
    toolName: "outlit_query",
    description:
      "Execute raw SQL queries against your analytics data.\n\nAvailable tables:\n- events: Customer activity events (event_type, event_channel, customer_id, occurred_at, properties, ...)\n- customer_dimensions: Customer attributes (customer_id, domain, name, billing_status, plan, mrr_cents, ...)\n- user_dimensions: User attributes (user_id, email, name, customer_id, ...)\n- mrr_snapshots: Revenue snapshots over time (customer_id, snapshot_date, mrr_cents, ...)\n\nAll queries are automatically filtered to your organization's data.\nOnly SELECT queries are allowed.\n\nExample queries:\n- SELECT event_type, count(*) FROM events GROUP BY 1 ORDER BY 2 DESC LIMIT 10\n- SELECT billing_status, sum(mrr_cents)/100 as mrr FROM customer_dimensions GROUP BY 1\n- SELECT * FROM events WHERE customer_id = 'cust_123' ORDER BY occurred_at DESC LIMIT 50",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "SQL SELECT query to execute",
        },
        limit: {
          description: "Max rows to return (default 1000, max 10000)",
          default: 1000,
          type: "number",
          maximum: 10000,
        },
      },
      required: ["sql"],
      additionalProperties: false,
    },
  },
  outlit_schema: {
    toolName: "outlit_schema",
    description:
      "Get table schemas for available analytics tables.\n\nUse this to discover column names, types, and descriptions before writing SQL queries.\nReturns column definitions and example queries for each table.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        table: {
          description: "Specific table to describe, or omit for all tables",
          type: "string",
          enum: ["events", "customer_dimensions", "user_dimensions", "mrr_snapshots"],
        },
      },
      additionalProperties: false,
    },
  },
} as const

export const customerBillingStatuses = [
  "NONE",
  "TRIALING",
  "PAYING",
  "PAST_DUE",
  "CHURNED",
] as const

export const customerActivityWindows = ["7d", "14d", "30d", "90d"] as const

export const customerFactStatuses = [
  "ACTIVE",
  "ACKNOWLEDGED",
  "RESOLVED",
  "SNOOZED",
  "CANDIDATE",
] as const

export const customerFactIncludes = ["evidence"] as const

export const customerListOrderFields = [
  "last_activity_at",
  "first_seen_at",
  "name",
  "mrr_cents",
] as const

export const customerIncludeSections = [
  "users",
  "revenue",
  "recentTimeline",
  "behaviorMetrics",
] as const

export const customerSourceTypes = ["EMAIL", "CALL", "CALENDAR_EVENT", "SUPPORT_TICKET"] as const

export const customerTimeframes = ["7d", "14d", "30d", "90d"] as const

export const timelineChannels = [
  "SDK",
  "EMAIL",
  "SLACK",
  "CALL",
  "CRM",
  "BILLING",
  "SUPPORT",
  "INTERNAL",
] as const

export const timelineTimeframes = ["7d", "14d", "30d", "90d", "all"] as const

export const userJourneyStages = [
  "DISCOVERED",
  "SIGNED_UP",
  "ACTIVATED",
  "ENGAGED",
  "INACTIVE",
] as const

export const userListOrderFields = ["last_activity_at", "first_seen_at", "email"] as const

export const schemaTables = [
  "events",
  "customer_dimensions",
  "user_dimensions",
  "mrr_snapshots",
] as const

export const customerToolContractHash =
  "723c552610b62397f04eb941a656e858772b876bf876065f05bc96ad019aac0b" as const

export type CustomerToolName = (typeof customerToolNames)[number]

export type CustomerToolContract = {
  toolName: CustomerToolName
  description: string
  inputSchema: JsonSchema
}

const customerToolNameSet = new Set<string>(customerToolNames)

export function isCustomerToolName(value: string): value is CustomerToolName {
  return customerToolNameSet.has(value)
}

export function getCustomerToolContract(name: CustomerToolName): CustomerToolContract {
  return customerToolContracts[name]
}

export type SearchArgsLike = {
  query?: string
  customer?: string
  topK?: number
  after?: string
  before?: string
  sourceTypes?: string[]
}

export type CustomerContextSearchInput = {
  query: string
  customer?: string
  topK?: number
  after?: string
  before?: string
  sourceTypes?: string[]
}

export function resolveCustomerContextSearchInput(value: SearchArgsLike):
  | { ok: true; request: CustomerContextSearchInput }
  | {
      ok: false
      message: string
    } {
  if (!value.query) {
    return {
      ok: false,
      message: "A query argument is required",
    }
  }

  const normalizedQuery = value.query.trim()
  if (normalizedQuery.length < 2) {
    return {
      ok: false,
      message: "Query must be at least 2 non-whitespace characters",
    }
  }

  if (
    value.after !== undefined &&
    value.before !== undefined &&
    new Date(value.after).getTime() > new Date(value.before).getTime()
  ) {
    return {
      ok: false,
      message: "--after must be before or equal to --before",
    }
  }

  return {
    ok: true,
    request: {
      query: normalizedQuery,
      customer: value.customer,
      topK: value.topK,
      after: value.after,
      before: value.before,
      sourceTypes: value.sourceTypes,
    },
  }
}
