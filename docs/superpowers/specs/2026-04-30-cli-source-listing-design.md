# CLI Source Listing And Tool Contract Design

## Goal

Improve the Outlit CLI and tool API so agents can deterministically list and inspect customer context sources. The first implementation should stay small: source listing, richer auth context, and clearer search/list guidance. Notification markdown/channel formatting and Granola-specific dedupe are out of scope.

## Decisions

- Add `outlit_list_sources` as the new tool contract and `outlit sources list` as the CLI command.
- Keep the API generic under `sources`, not `calls`. Calls are one source type, and `sources get` already exists.
- Keep `EMAIL` as message-level canonical source identity. Email list results may include thread metadata, but `EMAIL_THREAD` is not added in this pass.
- Use SQL source tables as canonical source records.
- Use ClickHouse only as a customer-scope selector when a `customer` filter is provided, then hydrate selected source records from SQL.
- Return the same normalized source envelope from `sources list` and `sources get`.
- Put curated source-specific fields under `record`; do not expose raw database model rows.
- Normalize `participants` in the source envelope for every source type.
- Support `participant` filtering for `CALL`, `CALENDAR_EVENT`, `EMAIL`, `SUPPORT_TICKET`, and `OPPORTUNITY`, using persisted source fields before pagination.
- Enhance `auth whoami --json`; do not add a separate `auth context` command yet.

## Source Semantics

`outlit sources list` returns source records, not semantic search chunks. The source detail endpoint remains exact:

- `sources list`: deterministic enumeration
- `sources get`: exact lookup by `sourceType` and `sourceId`
- `search`: semantic retrieval and ranking

For org-wide listing, source-specific SQL queries provide results directly from canonical tables:

- `CALL` from `Call`
- `CALENDAR_EVENT` from `CalendarEvent`
- `EMAIL` from `Email`
- `SUPPORT_TICKET` from `SupportTicket`
- `OPPORTUNITY` from `Opportunity`

For customer-scoped listing, ClickHouse events provide the customer-specific `(source_type, source_id)` set and latest occurrence ordering. SQL source tables hydrate details and participants. This keeps ClickHouse as the customer activity index while preserving SQL as the canonical source record layer.

## Tool Input

`outlit_list_sources` should accept:

- `sourceType?: "CALL" | "CALENDAR_EVENT" | "EMAIL" | "SUPPORT_TICKET" | "OPPORTUNITY"`
- `customer?: string`
- `after?: string`
- `before?: string`
- `participant?: string`
- `provider?: string`
- `hasTranscript?: boolean`
- `limit?: number`
- `cursor?: string`

Date strings use ISO 8601. `limit` should be bounded, with a default around 50 and max around 100.

## Source Record Envelope

`sources list` and `sources get` should share the same response concept: a generic source envelope plus a curated source-specific `record`.

The generic envelope contains cross-source fields that agents can rely on without branching by source type:

```ts
type SourceRecord<TRecord = SourceSpecificRecord> = {
  sourceType: "CALL" | "CALENDAR_EVENT" | "EMAIL" | "SUPPORT_TICKET" | "OPPORTUNITY"
  sourceId: string
  occurredAt: string | null
  title: string | null
  summary: string | null
  permalink: string | null
  provider: string | null
  customer: { id: string; name: string; domain: string } | null
  participants: Array<{
    email: string | null
    name: string | null
    role: string
    affiliation: "internal" | "external" | "unknown" | null
    resolvedUserId: string | null
  }>
  record: TRecord
}
```

The `record` field is source-specific and curated. It should contain useful fields from the source database model, but not raw rows or all columns. Sensitive, bulky, or internal fields such as `rawData`, full email bodies, full transcripts, internal sync fields, deletion timestamps, and provider-specific unbounded payloads are excluded from list responses.

`sources list` returns summary records:

```ts
type SourceListResponse = {
  items: Array<SourceRecord<SourceSummaryRecord>>
  pagination: { hasMore: boolean; nextCursor: string | null }
}
```

`sources get` returns one detailed source record:

```ts
type SourceGetResponse = SourceRecord<SourceDetailRecord>
```

Summary and detail modes use the same envelope. Detail mode may include larger but still curated fields, such as transcript excerpts, email body excerpts, support ticket description excerpts, opportunity description excerpts, or related activity metadata.

Source-specific records should start with these shapes:

```ts
type CallSummaryRecord = {
  kind: "call"
  scheduledAt: string | null
  durationSeconds: number | null
  hasTranscript: boolean
}

type CalendarEventSummaryRecord = {
  kind: "calendar_event"
  startDateTime: string
  endDateTime: string
  location: string | null
  status: string
  hasLinkedCall: boolean
}

type EmailSummaryRecord = {
  kind: "email"
  from: string | null
  to: string | null
  cc: string | null
  bcc: string | null
  thread: {
    id: string
    externalId: string | null
    subject: string | null
    messageCount: number
  } | null
}

type SupportTicketSummaryRecord = {
  kind: "support_ticket"
  status: string
  priority: string | null
  requesterEmail: string | null
  requesterName: string | null
  isClosed: boolean
}

type OpportunitySummaryRecord = {
  kind: "crm_opportunity"
  stageLabel: string | null
  pipelineName: string | null
  amount: number | null
  currency: string | null
  closeDate: string | null
  ownerEmail: string | null
  ownerName: string | null
}
```

Existing `sources get` currently returns a resolution wrapper with a heterogeneous `record`. This pass should align it with the shared `SourceRecord` envelope. If backward compatibility requires preserving the existing wrapper temporarily, the normalized source record should still be present in a stable field and the CLI should display the normalized shape.

## Participant Filtering

Participant filtering must happen before pagination.

Source-specific matching:

- `CALL`: `CallParticipant.email`, `CallParticipant.name`
- `CALENDAR_EVENT`: organizer email/name and attendee email/name from `attendees`
- `EMAIL`: `from`, `to`, `cc`, `bcc`
- `SUPPORT_TICKET`: requester email/name
- `OPPORTUNITY`: contact email/name and owner email/name

Calendar attendees are stored as JSON. If Prisma cannot express the predicate cleanly, use a focused raw SQL helper or preselect matching calendar event ids before the main source query. Do not fetch a page and then filter it in memory.

## Pagination

Use stable cursor ordering:

```ts
occurredAt desc, sourceType asc, sourceId desc
```

The cursor should encode the last returned tuple:

```ts
{ occurredAt: string; sourceType: string; sourceId: string }
```

For customer-scoped listing, ClickHouse should dedupe by `(source_type, source_id)` and order by latest `occurred_at`. Hydration may drop deleted or unsupported records; the implementation should overfetch enough to return a full page when possible.

## Auth Context

Enhance `auth whoami --json` using Core's validation endpoint. Include:

- `organizationId`
- `organizationName`
- `organizationSlug`
- `apiKeyName`
- `apiKeyPrefix`
- `createdById`

This avoids introducing `auth context` until there is a real need for context switching.

## Exclusions

- No `outlit calls list` in this pass.
- No `EMAIL_THREAD` source type in this pass.
- No Granola/canonical dedupe work.
- No notification markdown rendering or multi-channel formatting.
- No reliance on legacy SQL `CustomerActivity`.

## Testing

Core should test:

- contract schema validation
- source-type listing per supported source
- customer-scoped listing through ClickHouse selector and SQL hydration
- participant filtering per source, including calendar attendees
- cursor stability
- richer auth validation response

SDK should test:

- `outlit sources list` argument parsing
- JSON output shape
- help text distinguishing `search`, `sources list`, and `sources get`
- `auth whoami --json` output for new fields
