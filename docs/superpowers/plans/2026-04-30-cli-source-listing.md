# CLI Source Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic source listing to the Outlit tool API and CLI, align `sources get` with the same source envelope, and expose richer auth context.

**Architecture:** Core owns tool contracts, source record normalization, source listing, customer-scoped ClickHouse selection, and API key validation metadata. The SDK consumes generated contracts and adds CLI command surfaces for `outlit sources list`, better `sources get` help, richer `auth whoami --json`, and clearer search/list guidance. SQL source tables remain canonical; ClickHouse is used only to select customer-scoped source refs before SQL hydration.

**Tech Stack:** TypeScript, Next.js route handlers, Prisma, ClickHouse client helpers, Zod, Bun, Citty CLI, Vitest.

---

## File Map

Core worktree: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts`

- Modify `packages/tool-contracts/src/customer-context.ts`: add shared source-list input schema and source record output schemas.
- Modify `packages/tool-contracts/src/customer-tools.ts`: add `outlit_list_sources` to `toolNames` and `customerToolContracts`.
- Create `apps/platform/lib/customers/data-sources/source-records.ts`: convert source-table rows into the shared `SourceRecord` envelope for summary/detail modes.
- Create `apps/platform/lib/customers/data-sources/source-list.ts`: validate list options, query source tables, use ClickHouse for customer-scoped source refs, merge/hydrate/page results.
- Modify `apps/platform/lib/customers/data-sources/context-source.ts`: reuse `source-records.ts` so `sources get` returns the normalized envelope.
- Create `apps/platform/app/api/internal/mcp/context-sources/route.ts`: internal MCP route for `outlit_list_sources`.
- Modify `apps/platform/app/api/tools/call/route.ts`: forward `outlit_list_sources`.
- Modify `apps/platform/lib/api/mcp-api-key-config.ts`: include key/org metadata in key lookup result.
- Modify `apps/platform/lib/api/validate-api-key-route.ts`: return richer auth context.
- Modify route/unit tests under nearby `__tests__` folders.
- Run `OUTLIT_SDK_REPO=/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1 bun scripts/generate-tool-contracts-for-sdk.ts` from Core after contracts pass.

SDK worktree: `/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1`

- Generated: `packages/tools/src/contracts.ts`.
- Create `packages/cli/src/commands/sources/list.ts`: CLI command for the new tool.
- Modify `packages/cli/src/commands/sources/index.ts`: register `list` and update help text.
- Modify `packages/cli/src/commands/sources/get.ts`: update help text around normalized envelope.
- Modify `packages/cli/src/commands/search.ts`: clarify semantic search vs deterministic source listing.
- Modify `packages/cli/src/commands/auth/whoami.ts`: print richer JSON fields.
- Modify `packages/cli/src/lib/api.ts`: make `pingApiKey` / `validateKeyOrExit` return the validation payload instead of `void`.
- Verify SDK behavior with generated contract typechecking and CLI package build.

## Task 1: Core Tool Contracts

**Files:**
- Modify: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/packages/tool-contracts/src/customer-context.ts`
- Modify: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/packages/tool-contracts/src/customer-tools.ts`

- [ ] **Step 1: Add failing schema tests**

Add tests near existing tool contract tests. If there is no dedicated contract test file, create:

`/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/packages/tool-contracts/src/__tests__/customer-tools.unit.test.ts`

Test cases:

```ts
import { describe, expect, it } from "vitest"
import {
  CustomerSourceListInputSchema,
  SourceListResponseSchema,
} from "../customer-context"
import {
  customerToolContracts,
  toolNames,
} from "../customer-tools"

describe("source list tool contract", () => {
  it("registers outlit_list_sources", () => {
    expect(toolNames).toContain("outlit_list_sources")
    expect(customerToolContracts.outlit_list_sources.toolName).toBe("outlit_list_sources")
  })

  it("accepts participant and customer filters", () => {
    const parsed = CustomerSourceListInputSchema.parse({
      sourceType: "CALENDAR_EVENT",
      customer: "acme.com",
      participant: "alice@acme.com",
      after: "2026-01-01T00:00:00.000Z",
      before: "2026-02-01T00:00:00.000Z",
      limit: 25,
    })

    expect(parsed.sourceType).toBe("CALENDAR_EVENT")
    expect(parsed.limit).toBe(25)
  })

  it("validates the shared source envelope", () => {
    const parsed = SourceListResponseSchema.parse({
      items: [
        {
          sourceType: "EMAIL",
          sourceId: "email_123",
          occurredAt: "2026-01-02T03:04:05.000Z",
          title: "Security review",
          summary: null,
          permalink: null,
          provider: "gmail",
          customer: { id: "cust_123", name: "Acme", domain: "acme.com" },
          participants: [],
          record: {
            kind: "email",
            from: "alice@acme.com",
            to: "rep@outlit.ai",
            cc: null,
            bcc: null,
            thread: null,
          },
        },
      ],
      pagination: { hasMore: false, nextCursor: null },
    })

    expect(parsed.items[0]!.record.kind).toBe("email")
  })
})
```

- [ ] **Step 2: Run the failing tests**

Run from Core:

```bash
bun test packages/tool-contracts/src/__tests__/customer-tools.unit.test.ts
```

Expected: fail because `CustomerSourceListInputSchema`, `SourceListResponseSchema`, and `outlit_list_sources` do not exist yet.

- [ ] **Step 3: Add contract schemas**

In `packages/tool-contracts/src/customer-context.ts`, add exported schemas:

```ts
export const SourceParticipantSchema = z.object({
  email: z.string().email().nullable(),
  name: z.string().max(500).nullable(),
  role: z.string().max(100),
  affiliation: z.enum(["internal", "external", "unknown"]).nullable(),
  resolvedUserId: z.string().max(500).nullable(),
})

export const SourceCustomerSchema = z.object({
  id: z.string().min(1).max(500),
  name: z.string().min(1).max(500),
  domain: z.string().min(1).max(500),
})

export const SourceRecordSchema = z.object({
  sourceType: CustomerSourceTypeSchema,
  sourceId: z.string().min(1).max(500),
  occurredAt: z.string().datetime().nullable(),
  title: z.string().max(1_000).nullable(),
  summary: z.string().max(20_000).nullable(),
  permalink: z.string().max(2_000).nullable(),
  provider: z.string().max(200).nullable(),
  customer: SourceCustomerSchema.nullable(),
  participants: z.array(SourceParticipantSchema),
  record: z.record(z.string(), z.unknown()),
})

export const SourceListPaginationSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
})

export const SourceListResponseSchema = z.object({
  items: z.array(SourceRecordSchema),
  pagination: SourceListPaginationSchema,
})

export const CustomerSourceListInputSchema = z
  .object({
    sourceType: CustomerSourceTypeInputSchema.optional(),
    customer: z.string().min(1).max(200).optional(),
    after: z.string().datetime().optional(),
    before: z.string().datetime().optional(),
    participant: z.string().min(1).max(500).optional(),
    provider: z.string().min(1).max(200).optional(),
    hasTranscript: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).default(50).optional(),
    cursor: z.string().min(1).max(2_000).optional(),
  })
  .strict()

export type CustomerSourceListInput = z.infer<typeof CustomerSourceListInputSchema>
export type SourceRecord = z.infer<typeof SourceRecordSchema>
export type SourceListResponse = z.infer<typeof SourceListResponseSchema>
```

In `packages/tool-contracts/src/customer-tools.ts`, import `CustomerSourceListInputSchema`, add `"outlit_list_sources"` after `"outlit_get_source"` in `toolNames`, and add the contract:

```ts
{
  name: "outlit_list_sources",
  description:
    "List concrete source records deterministically. Use this instead of semantic search when you need enumerated calls, emails, calendar events, support tickets, or opportunities.",
  inputSchema: CustomerSourceListInputSchema,
}
```

- [ ] **Step 4: Run contract tests**

Run:

```bash
bun test packages/tool-contracts/src/__tests__/customer-tools.unit.test.ts
```

Expected: pass.

## Task 2: Core Source Record Envelope

**Files:**
- Create: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/lib/customers/data-sources/source-records.ts`
- Test: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/lib/customers/data-sources/__tests__/unit/source-records.unit.test.ts`

- [ ] **Step 1: Add tests for normalized records**

Create unit tests covering at least `CALL`, `CALENDAR_EVENT`, and `EMAIL`:

```ts
import { describe, expect, it } from "vitest"
import {
  normalizeCalendarAttendees,
  toCallSourceRecord,
  toCalendarEventSourceRecord,
  toEmailSourceRecord,
} from "../../source-records"

describe("source record envelope", () => {
  it("maps call participants and summary record", () => {
    const result = toCallSourceRecord({
      call: {
        id: "call_123",
        title: "Technical validation",
        started: new Date("2026-04-18T15:00:00.000Z"),
        scheduled: null,
        duration: 1800,
        summary: "Discussed rollout",
        url: "https://gong.example/call",
        meetingUrl: null,
        sourceProvider: "gong",
        customer: { id: "cust_1", name: "Acme", domain: "acme.com" },
        participants: [
          {
            email: "alice@acme.com",
            name: "Alice",
            affiliation: "External",
            userId: null,
          },
        ],
        CallTranscript: [{ id: "transcript_1" }],
      },
      mode: "summary",
    })

    expect(result).toMatchObject({
      sourceType: "CALL",
      sourceId: "call_123",
      provider: "gong",
      record: { kind: "call", durationSeconds: 1800, hasTranscript: true },
    })
    expect(result.participants[0]).toMatchObject({
      email: "alice@acme.com",
      role: "participant",
      affiliation: "external",
    })
  })

  it("maps calendar organizer and attendees", () => {
    const attendees = normalizeCalendarAttendees([
      { email: "rep@outlit.ai", displayName: "Rep" },
      { email: "buyer@acme.com", displayName: "Buyer" },
    ])

    const result = toCalendarEventSourceRecord({
      event: {
        id: "cal_123",
        summary: "Security review",
        startDateTime: new Date("2026-04-18T15:00:00.000Z"),
        endDateTime: new Date("2026-04-18T15:30:00.000Z"),
        location: null,
        status: "confirmed",
        htmlLink: "https://calendar.example/event",
        organizerEmail: "rep@outlit.ai",
        organizerName: "Rep",
        attendees,
        calls: [],
        integrationConnection: { providerId: "google-calendar", provider: { name: "Google Calendar" } },
      },
      mode: "summary",
    })

    expect(result.sourceType).toBe("CALENDAR_EVENT")
    expect(result.participants.map((p) => p.email)).toContain("buyer@acme.com")
    expect(result.record).toMatchObject({ kind: "calendar_event", status: "confirmed" })
  })

  it("maps email with thread metadata under record", () => {
    const result = toEmailSourceRecord({
      email: {
        id: "email_123",
        subject: "Security review",
        date: new Date("2026-04-18T15:00:00.000Z"),
        from: "buyer@acme.com",
        to: "rep@outlit.ai",
        cc: null,
        bcc: null,
        snippet: "Can you send the SOC2?",
        body: null,
        thread: {
          id: "thread_123",
          externalId: "gmail_thread_123",
          subject: "Security review",
          messageCount: 4,
        },
        integrationConnection: { providerId: "gmail", provider: { name: "Gmail" } },
      },
      mode: "summary",
    })

    expect(result.record).toMatchObject({
      kind: "email",
      thread: { id: "thread_123", messageCount: 4 },
    })
  })
})
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
bun test apps/platform/lib/customers/data-sources/__tests__/unit/source-records.unit.test.ts
```

Expected: fail because `source-records.ts` does not exist.

- [ ] **Step 3: Implement source record mapping**

Create `source-records.ts` with:

```ts
export type SourceRecordMode = "summary" | "detail"

export function normalizeAffiliation(value: string | null | undefined) {
  const normalized = value?.toLowerCase()
  if (normalized === "internal" || normalized === "external") return normalized
  return "unknown"
}

export function normalizeCalendarAttendees(value: unknown): Array<{ email?: string; displayName?: string; name?: string }> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : []
}
```

Then add `toCallSourceRecord`, `toCalendarEventSourceRecord`, `toEmailSourceRecord`, `toSupportTicketSourceRecord`, and `toOpportunitySourceRecord`. Each mapper must:

- set `sourceType` and `sourceId`
- put common fields in the envelope
- put source-specific fields under `record`
- exclude `rawData`, full body, full transcript, and sync/deletion internals from summary mode
- include excerpts, not full large fields, in detail mode

- [ ] **Step 4: Run source record tests**

Run:

```bash
bun test apps/platform/lib/customers/data-sources/__tests__/unit/source-records.unit.test.ts
```

Expected: pass.

## Task 3: Core Source List Service And Route

**Files:**
- Create: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/lib/customers/data-sources/source-list.ts`
- Create: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/app/api/internal/mcp/context-sources/route.ts`
- Modify: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/app/api/tools/call/route.ts`
- Test: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/lib/customers/data-sources/__tests__/unit/source-list.unit.test.ts`
- Test: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/app/api/tools/call/__tests__/route.test.ts`

- [ ] **Step 1: Add failing service tests**

Create pure helper tests that make pagination and participant filtering deterministic before wiring database calls:

```ts
import { describe, expect, it } from "vitest"
import {
  buildCallSourceWhere,
  buildCalendarSourceWhere,
  decodeSourceCursor,
  encodeSourceCursor,
} from "../../source-list"

describe("listSources", () => {
  it("builds call participant filters in the SQL where input", () => {
    expect(
      buildCallSourceWhere({
        organizationId: "org_123",
        participant: "alice@acme.com",
        after: new Date("2026-04-01T00:00:00.000Z"),
        before: new Date("2026-05-01T00:00:00.000Z"),
        hasTranscript: true,
      }),
    ).toMatchObject({
      organizationId: "org_123",
      isDeleted: false,
      started: {
        gte: new Date("2026-04-01T00:00:00.000Z"),
        lt: new Date("2026-05-01T00:00:00.000Z"),
      },
      participants: {
        some: {
          OR: [
            { email: { contains: "alice@acme.com" } },
            { name: { contains: "alice@acme.com" } },
          ],
        },
      },
      CallTranscript: {
        some: {
          isDeleted: false,
          isFinal: true,
        },
      },
    })
  })

  it("builds calendar participant filters over organizer and attendee JSON", () => {
    expect(
      buildCalendarSourceWhere({
        organizationId: "org_123",
        participant: "buyer@acme.com",
      }),
    ).toMatchObject({
      organizationId: "org_123",
      isDeleted: false,
      OR: expect.arrayContaining([
        { organizerEmail: { contains: "buyer@acme.com" } },
        { organizerName: { contains: "buyer@acme.com" } },
      ]),
    })
  })

  it("encodes and decodes source cursors", () => {
    const cursor = encodeSourceCursor({
      occurredAt: "2026-04-18T15:00:00.000Z",
      sourceType: "CALL",
      sourceId: "call_123",
    })
    expect(decodeSourceCursor(cursor)).toEqual({
      occurredAt: "2026-04-18T15:00:00.000Z",
      sourceType: "CALL",
      sourceId: "call_123",
    })
  })
})
```

- [ ] **Step 2: Run failing service tests**

Run:

```bash
bun test apps/platform/lib/customers/data-sources/__tests__/unit/source-list.unit.test.ts
```

Expected: fail because `source-list.ts` does not exist.

- [ ] **Step 3: Implement `source-list.ts`**

Create functions:

```ts
export function encodeSourceCursor(cursor: SourceCursor): string
export function decodeSourceCursor(cursor: string): SourceCursor | null
export async function listSources(params: CustomerSourceListInput & { organizationId: string }): Promise<SourceListResponse>
```

Implementation rules:

- default `limit` to 50 and fetch `limit + 1`
- sort by `occurredAt desc`, `sourceType asc`, `sourceId desc`
- use SQL source tables for org-wide listing
- if `customer` is present, resolve the customer through existing ClickHouse customer lookup helpers, query distinct `(source_type, source_id, max(occurred_at))`, then hydrate matching SQL records
- filter out null `source_type` / `source_id`
- normalize source aliases before hydration, including `CRM_OPPORTUNITY` to `OPPORTUNITY` if needed
- overfetch when customer-scoped hydration drops deleted rows
- apply participant filters in SQL predicates or source-id preselection before pagination

Also export these pure helpers for unit tests:

```ts
export function buildCallSourceWhere(input: SourceListQueryInput): Prisma.CallWhereInput
export function buildCalendarSourceWhere(input: SourceListQueryInput): Prisma.CalendarEventWhereInput
```

- [ ] **Step 4: Add route**

Create `apps/platform/app/api/internal/mcp/context-sources/route.ts`:

```ts
import { createInternalMcpRoute } from "@/lib/api/internal-mcp-route"
import { listSources } from "@/lib/customers/data-sources/source-list"
import { CustomerSourceListInputSchema } from "@outlit/tool-contracts/customer-context"
import { NextRequest, NextResponse } from "next/server"

const handler = async (request: NextRequest, auth: { organizationId: string }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = CustomerSourceListInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.issues }, { status: 400 })
  }

  const result = await listSources({ ...parsed.data, organizationId: auth.organizationId })
  return NextResponse.json(result)
}

export const POST = createInternalMcpRoute(handler, { billing: "api-call" })
```

- [ ] **Step 5: Wire public tool router**

In `apps/platform/app/api/tools/call/route.ts`:

- import `POST as listSources` from the new route
- add `outlit_list_sources` to `customerToolRoutes` with `method: "POST"` and path `/api/internal/mcp/context-sources`

- [ ] **Step 6: Run route and service tests**

Run:

```bash
bun test apps/platform/lib/customers/data-sources/__tests__/unit/source-list.unit.test.ts
bun test apps/platform/app/api/tools/call/__tests__/route.test.ts
```

Expected: pass.

## Task 4: Core `sources get` Envelope Alignment

**Files:**
- Modify: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/lib/customers/data-sources/context-source.ts`
- Test: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/lib/customers/data-sources/__tests__/unit/context-source.unit.test.ts`

- [ ] **Step 1: Add failing tests for normalized `sources get`**

Update existing tests to assert the normalized envelope:

```ts
expect(result).toMatchObject({
  supported: true,
  source: {
    sourceType: "EMAIL",
    sourceId: "email_123",
    record: { kind: "email" },
  },
})
```

Keep the existing resolution wrapper for compatibility in this implementation. Add the normalized source record at `source` and leave `relatedActivities` / unsupported responses intact.

- [ ] **Step 2: Run failing context-source tests**

Run:

```bash
bun test apps/platform/lib/customers/data-sources/__tests__/unit/context-source.unit.test.ts
```

Expected: fail on old heterogeneous shape.

- [ ] **Step 3: Reuse `source-records.ts` in exact lookup**

Refactor each resolver in `context-source.ts` to return a detailed `SourceRecord` under the same envelope. Detail mode may include:

- email `bodyExcerpt`
- call `transcriptExcerpt`
- support ticket `descriptionExcerpt`
- opportunity `descriptionExcerpt`
- related activity metadata if the existing API still needs it

Keep unsupported/fact-source resolution behavior intact.

- [ ] **Step 4: Run context-source tests**

Run:

```bash
bun test apps/platform/lib/customers/data-sources/__tests__/unit/context-source.unit.test.ts
```

Expected: pass.

## Task 5: Core Auth Context

**Files:**
- Modify: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/lib/api/mcp-api-key-config.ts`
- Modify: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/lib/api/validate-api-key-route.ts`
- Test: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/app/api/validate-api-key/__tests__/route.test.ts`
- Test: `/Users/leopaz/conductor/workspaces/Core/better-tool-contracts/apps/platform/lib/api/__tests__/unit/mcp-api-key-config.unit.test.ts`

- [ ] **Step 1: Add failing tests for richer validation**

Assert validate response includes:

```ts
{
  valid: true,
  organizationId: "org_123",
  organizationName: "Acme",
  organizationSlug: "acme",
  apiKeyName: "Local agent",
  apiKeyPrefix: "ok_live_abc",
  createdById: "user_123"
}
```

- [ ] **Step 2: Run failing auth tests**

Run:

```bash
bun test apps/platform/app/api/validate-api-key/__tests__/route.test.ts apps/platform/lib/api/__tests__/unit/mcp-api-key-config.unit.test.ts
```

Expected: fail because lookup does not select org/key metadata yet.

- [ ] **Step 3: Select metadata**

Update `ActiveMcpApiKeyConfig`:

```ts
export interface ActiveMcpApiKeyConfig {
  id: string
  name: string | null
  keyPrefix: string | null
  organizationId: string
  organizationName: string | null
  organizationSlug: string | null
  createdById: string | null
}
```

Select `name`, `keyPrefix`, and `organization: { select: { name: true, slug: true } }`.

- [ ] **Step 4: Return metadata from validation**

Return fields from direct API-key validation. For bearer/internal validation, return organization fields when available and set `apiKeyName: null` and `apiKeyPrefix: null`.

- [ ] **Step 5: Run auth tests**

Run:

```bash
bun test apps/platform/app/api/validate-api-key/__tests__/route.test.ts apps/platform/lib/api/__tests__/unit/mcp-api-key-config.unit.test.ts
```

Expected: pass.

## Task 6: Generate SDK Tool Contracts

**Files:**
- Generated: `/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1/packages/tools/src/contracts.ts`

- [ ] **Step 1: Generate contracts from Core**

Run from Core:

```bash
OUTLIT_SDK_REPO=/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1 bun scripts/generate-tool-contracts-for-sdk.ts
```

Expected: `packages/tools/src/contracts.ts` changes in SDK and includes `outlit_list_sources`, `CustomerSourceListInputSchema`, and `SourceRecord`/list response schemas.

- [ ] **Step 2: Check generated diff**

Run from SDK:

```bash
git diff -- packages/tools/src/contracts.ts
```

Expected: generated contract changes only; no manual formatting edits.

## Task 7: SDK CLI Sources List

**Files:**
- Create: `/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1/packages/cli/src/commands/sources/list.ts`
- Modify: `/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1/packages/cli/src/commands/sources/index.ts`
- Modify: `/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1/packages/cli/src/commands/sources/get.ts`
- Modify: `/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1/packages/cli/src/commands/search.ts`

- [ ] **Step 1: Create `sources list` command**

Create `packages/cli/src/commands/sources/list.ts`:

```ts
import {
  customerSourceTypeAliases,
  customerSourceTypeInputs,
  customerSourceTypes,
  customerToolContracts,
  normalizeCustomerSourceType,
} from "@outlit/tools"
import { defineCommand } from "citty"
import { authArgs } from "../../args/auth"
import { AGENT_JSON_HINT, outputArgs } from "../../args/output"
import { getClientOrExit, runTool } from "../../lib/api"
import { outputError } from "../../lib/output"

const sourceTypeDescription = `${customerSourceTypes.join(", ")} (aliases: ${customerSourceTypeAliases.join(", ")})`

export default defineCommand({
  meta: {
    name: "list",
    description: [
      "List concrete source records deterministically.",
      "",
      "Use this for enumeration. Use `outlit search` for semantic retrieval.",
      "",
      "Examples:",
      "  outlit sources list --customer acme.com --source-type CALL",
      "  outlit sources list --participant alice@acme.com --source-type CALENDAR_EVENT --json",
      "  outlit sources list --after 2026-01-01T00:00:00Z --limit 25",
      "",
      `Source types: ${sourceTypeDescription}`,
      "",
      AGENT_JSON_HINT,
    ].join("\n"),
  },
  args: {
    ...authArgs,
    ...outputArgs,
    "source-type": { type: "string", description: `Source type (${sourceTypeDescription})` },
    customer: { type: "string", description: "Customer ID, domain, or name" },
    after: { type: "string", description: "Only sources at or after this ISO datetime" },
    before: { type: "string", description: "Only sources before this ISO datetime" },
    participant: { type: "string", description: "Participant email or name filter" },
    provider: { type: "string", description: "Provider filter, e.g. gmail, gong, google-calendar" },
    "has-transcript": { type: "boolean", description: "Only call sources with transcript state" },
    limit: { type: "string", description: "Results per page, 1-100. Default: 50." },
    cursor: { type: "string", description: "Pagination cursor from previous response" },
  },
  async run({ args }) {
    const json = !!args.json

    const sourceType = args["source-type"]
      ? normalizeCustomerSourceType(args["source-type"])
      : undefined
    if (args["source-type"] && !sourceType) {
      return outputError(
        { message: `--source-type must be one of ${customerSourceTypeInputs.join(", ")}`, code: "invalid_input" },
        json,
      )
    }

    const limit = args.limit ? Number(args.limit) : undefined
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      return outputError({ message: "--limit must be an integer between 1 and 100", code: "invalid_input" }, json)
    }

    const client = await getClientOrExit(args["api-key"], json)

    return runTool(
      client,
      customerToolContracts.outlit_list_sources.toolName,
      {
        sourceType,
        customer: args.customer,
        after: args.after,
        before: args.before,
        participant: args.participant,
        provider: args.provider,
        hasTranscript: args["has-transcript"],
        limit,
        cursor: args.cursor,
      },
      json,
      {
        table: {
          columns: [
            { header: "Type", key: "sourceType" },
            { header: "ID", key: "sourceId" },
            { header: "When", key: "occurredAt" },
            { header: "Title", key: "title" },
            { header: "Provider", key: "provider" },
          ],
        },
      },
    )
  },
})
```

- [ ] **Step 2: Register command and update help**

In `sources/index.ts`, add:

```ts
"  list -- enumerate concrete sources with filters",
```

and:

```ts
list: () => import("./list").then((m) => m.default),
```

Update `sources/get.ts` description to say the command returns the same normalized source envelope as `sources list`, with more detailed `record` fields.

Update `search.ts` description to include:

```ts
"Use `outlit sources list` when you need deterministic enumeration rather than semantic ranking.",
```

- [ ] **Step 3: Run SDK typecheck**

Run from SDK:

```bash
bun run typecheck --filter=@outlit/cli
```

When package filtering is unsupported for this script, run the full typecheck:

```bash
bun run typecheck
```

Expected: pass.

## Task 8: SDK Auth Whoami Context

**Files:**
- Modify: `/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1/packages/cli/src/lib/api.ts`
- Modify: `/Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1/packages/cli/src/commands/auth/whoami.ts`

- [ ] **Step 1: Return validation payload**

In `packages/cli/src/lib/api.ts`, add:

```ts
export interface ApiKeyValidationResult {
  valid: boolean
  organizationId?: string
  organizationName?: string | null
  organizationSlug?: string | null
  apiKeyName?: string | null
  apiKeyPrefix?: string | null
  createdById?: string | null
  error?: string
}
```

Change `pingApiKey` to return `Promise<ApiKeyValidationResult>` and return the parsed payload after validation. Change `validateKeyOrExit` to return `Promise<ApiKeyValidationResult>`.

- [ ] **Step 2: Print richer `whoami --json`**

In `whoami.ts`, capture:

```ts
const validation = await validateKeyOrExit(credential.key, json)
```

JSON output:

```ts
return outputResult({
  key: masked,
  source: credential.source,
  valid: true,
  organizationId: validation.organizationId ?? null,
  organizationName: validation.organizationName ?? null,
  organizationSlug: validation.organizationSlug ?? null,
  apiKeyName: validation.apiKeyName ?? null,
  apiKeyPrefix: validation.apiKeyPrefix ?? null,
  createdById: validation.createdById ?? null,
})
```

TTY output can remain compact:

```ts
const org = validation.organizationSlug ?? validation.organizationName ?? validation.organizationId
process.stdout.write(org ? `${masked} (${credential.source}, ${org})\n` : `${masked} (${credential.source})\n`)
```

- [ ] **Step 3: Run SDK typecheck**

Run:

```bash
bun run typecheck --filter=@outlit/cli
```

Expected: pass or use full `bun run typecheck` if filtering is unsupported.

## Task 9: End-To-End Verification

**Files:**
- Both worktrees as changed by prior tasks.

- [ ] **Step 1: Core verification**

Run from Core:

```bash
bun test packages/tool-contracts/src/__tests__/customer-tools.unit.test.ts
bun test apps/platform/lib/customers/data-sources/__tests__/unit/source-records.unit.test.ts
bun test apps/platform/lib/customers/data-sources/__tests__/unit/source-list.unit.test.ts
bun test apps/platform/lib/customers/data-sources/__tests__/unit/context-source.unit.test.ts
bun test apps/platform/app/api/tools/call/__tests__/route.test.ts
bun test apps/platform/app/api/validate-api-key/__tests__/route.test.ts apps/platform/lib/api/__tests__/unit/mcp-api-key-config.unit.test.ts
```

Expected: all pass.

- [ ] **Step 2: SDK verification**

Run from SDK:

```bash
bun run typecheck
bun run build
```

Expected: both pass.

- [ ] **Step 3: Inspect diffs**

Run:

```bash
git -C /Users/leopaz/conductor/workspaces/Core/better-tool-contracts diff --stat
git -C /Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1 diff --stat
```

Expected: Core includes contract/API/source-list/auth changes. SDK includes generated contracts, CLI commands, and docs/plan/spec changes.

- [ ] **Step 4: Commit worktree changes separately**

Commit Core from Core worktree:

```bash
git -C /Users/leopaz/conductor/workspaces/Core/better-tool-contracts status --short
git -C /Users/leopaz/conductor/workspaces/Core/better-tool-contracts add packages/tool-contracts apps/platform
git -C /Users/leopaz/conductor/workspaces/Core/better-tool-contracts commit -m "Add source listing tool contract"
```

Commit SDK from SDK worktree:

```bash
git -C /Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1 status --short
git -C /Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1 add packages/tools packages/cli docs/superpowers
git -C /Users/leopaz/conductor/workspaces/outlit-sdk/victoria-v1 commit -m "Add sources list CLI"
```

Use the hook-path override only if the known local Mint/lefthook issue still prevents commits:

```bash
git -c core.hooksPath=/dev/null commit -m "..."
```

## Self-Review

- Spec coverage: The plan covers `outlit_list_sources`, source-native canonical records, ClickHouse customer-scoped selection, participant filtering including calendar attendees, email message identity with thread metadata, shared list/get envelope, richer `auth whoami --json`, and search/list help text.
- Exclusions preserved: No `outlit calls list`, no `EMAIL_THREAD`, no Granola dedupe, no notification markdown work, and no legacy SQL `CustomerActivity` dependency.
- Type consistency: The shared envelope uses `sourceType`, `sourceId`, `occurredAt`, `participants`, and `record` consistently. Cursor shape uses `sourceId`, not `id`.
