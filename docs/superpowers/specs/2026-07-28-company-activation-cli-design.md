# Company Activation CLI Design

## Status

Approved product direction from the coordinating task and reconciled with the parallel
Core task's checkpoint-1 API contract.

## Problem

Outlit currently exposes contact journey stages and ordinary product-event tracking, but
the CLI cannot inspect, preview, or configure the separate company-level activation
milestone. Customers should not need to emit a synthetic activation event or call an
authoritative lifecycle SDK method. Core must derive company activation from existing
customer-grain signals and materialize it monotonically.

## CLI surface

```text
outlit activation get
outlit activation preview <definition flags> [--lookback-days 30] [--example-limit 10]
outlit activation update <definition flags>
outlit activation disable
outlit customers list --activated-since <ISO-8601 timestamp>
```

Definition flags:

- `--signal <id>` is the ergonomic single-signal form.
- `--signals <id,id,id>` selects two or three signals.
- `--match <ANY|ALL|AT_LEAST>` defaults to `ANY` for one signal and is required for
  multiple signals.
- `--threshold <2-3>` is required only for `AT_LEAST` and must not exceed the signal
  count.
- `--window <positive integer><h|d>` adds the optional bounded matching window for
  `ALL` or `AT_LEAST`.

`--signal` and `--signals` are mutually exclusive. Signal IDs are trimmed, deduplicated,
and limited to one through three values before any API client is created. A one-signal
definition requires `ANY`, which rejects both threshold and window. `ALL` requires two
or three signals and rejects threshold. `AT_LEAST` requires two or three signals and a
threshold from two through the signal count. `ALL` and `AT_LEAST` accept at most 168
hours or 90 days as a window. Preview validates `--lookback-days` from 1 through 90 and
`--example-limit` from 1 through 20, then calls the read-only preview route.

Update replaces the complete activation definition; no additive or partial update mode
is exposed. Disable is a separate command that sends `{ definition: null }`. Disabling
stops future evaluation and does not clear existing company activation timestamps or
milestones.

`--activated-since` accepts an ISO-8601 timestamp with `Z` or an explicit offset. The CLI
passes the validated value as `activatedSince` to the existing
`outlit_list_customers` public tool. Returned customer JSON preserves Core's nullable
`activatedAt` field without CLI rewriting.

## Typed boundary

The CLI owns a small activation contract module:

```ts
type ActivationMatchMode = "ANY" | "ALL" | "AT_LEAST"

interface ActivationDefinitionInput {
  signalIds: string[]
  matchMode: ActivationMatchMode
  thresholdCount?: number
  window?: { value: number; unit: "hour" | "day" }
}

interface ActivationPreviewInput {
  definition: ActivationDefinitionInput
  lookbackDays?: number
  exampleLimit?: number
}
```

Command code consumes these types and centralized tool-name constants rather than route
strings. The direct API endpoint map remains the single place where Core route names and
HTTP methods are bound. Core responses are emitted unchanged so the CLI retains existing
structured JSON behavior and does not create a second response envelope.

The Core routes are:

| Operation | Method and route | Request |
|---|---|---|
| Get | `GET /api/activation` | none |
| Preview | `POST /api/activation/preview` | `{ definition, lookbackDays?, exampleLimit? }` |
| Update / disable | `PATCH /api/activation` | `{ definition: ActivationDefinitionInput \| null }` |

The SDK PR will name the Core PR dependency and exact contract in its draft PR. It will
not call a live activation endpoint during development or tests.

## Output, auth, and errors

All commands use `getClientOrExit` and `runTool`:

- explicit `--json` and non-interactive stdout produce pretty-printed JSON;
- successful Core payloads pass through unchanged;
- structured Core command-error envelopes are preserved;
- unstructured HTTP failures remain `api_error`;
- missing/invalid local inputs exit with code 1 and `invalid_input` or `missing_input`;
- API-key precedence and validation remain unchanged.

No test may use production credentials or an unmocked network request.

## Compatibility and documentation

- Do not add `user.activate()`, `customer.activate()`, synthetic activation helpers, or
  SDK-owned lifecycle state.
- Existing contact `journeyStage` and contact-level `ACTIVATED` remain compatible and
  distinct from company `activatedAt`.
- Existing customer-list calls without `activatedSince` are byte-for-byte compatible at
  the request boundary.
- Help, generated shell completions, CLI docs, and customer-journey docs explain that
  company activation is Core-derived, monotonic, and based on one to three existing
  customer-grain signals.
- The public customers analytics view documents `activated_at` as nullable
  `DateTime64(3)`.

## Verification

Tests must cover command routing, the single-signal form, multi-signal modes,
`AT_LEAST` threshold rules, window validation, preview no-mutation routing, unchanged
structured output, API errors, `activatedSince`, completions, and shared tool schema.
Validation includes focused tests, CLI and tools package tests/typechecks, repository
lint/build as proportional, a full diff inspection, and fresh-context review.
