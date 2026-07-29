# Shared Contact and Company Activation CLI

Status: Approved replacement contract
Date: 2026-07-28

## Summary

Outlit already stores one exact ordinary product event name in
`TrackingPixelConfig.activationEvent`. The first matching event activates eligible contacts,
and Core now also sets the resolved company's nullable `activatedAt` when it is still null.

The CLI exposes this shared event setting through conventional get, historical preview,
update, and disable commands. Applications keep sending ordinary product events through the
existing tracking APIs or connected analytics sources. The CLI and SDK do not introduce an
activation lifecycle call or a synthetic activation event.

This design supersedes the earlier activation-definition design on this branch.

## CLI surface

```text
outlit activation get
outlit activation preview --event <exact-event-name> [--lookback-days 1..90] [--example-limit 1..20]
outlit activation update --event <exact-event-name>
outlit activation disable
outlit customers list --activated-since <ISO-8601 datetime>
```

`--event` is trimmed, must be non-empty, and is limited to 191 characters before client
creation. Preview validates `--lookback-days` as an integer from 1 through 90 and
`--example-limit` as an integer from 1 through 20. Optional preview bounds are omitted from
the request when the user does not provide them so Core owns the defaults.

Disable is a separate command. It sends `{ eventName: null }`, stops future matching, and
does not clear existing contact or company activation timestamps. Update sends one complete
replacement `{ eventName }`; saving it does not backfill history.

`--activated-since` accepts an ISO-8601 datetime with `Z` or an explicit offset. The CLI
passes the validated string unchanged as `activatedSince`. Customer list and detail output
preserve Core's nullable ISO-8601 UTC `activatedAt`, and the public analytics customers view
continues exposing nullable `activated_at`.

## Typed boundary

The CLI owns a small event-name contract module:

```ts
interface ActivationState {
  eventName: string | null
  behavior: "first_matching_product_event"
  appliesTo: ["contact", "company"]
}

interface ActivationPreviewInput {
  eventName: string
  lookbackDays?: number
  exampleLimit?: number
}

interface ActivationUpdateInput {
  eventName: string | null
}

interface ActivationPreviewExample {
  customer: {
    id: string
    name: string
    domain: string
  }
  activatedAt: string | null
  firstMatchedAt: string
  eventId: string
}
```

Preview returns `eventName`, `evaluatedFrom`, `evaluatedTo`, `evaluatedEventCount`,
`matchedCustomerCount`, `alreadyActivatedCustomerCount`, `wouldActivateCustomerCount`,
`truncated`, and `examples`.

The direct client binds the existing literal tool consumers to:

| Operation | Method and route | Request |
|---|---|---|
| Get | `GET /api/activation` | none |
| Preview | `POST /api/activation/preview` | `{ eventName, lookbackDays?, exampleLimit? }` |
| Update / disable | `PATCH /api/activation` | `{ eventName: string \| null }` |

Core responses remain inside the existing platform command envelope and pass through the CLI
unchanged. The CLI does not create a second JSON envelope.

## Behavior and compatibility

- The configured exact ordinary product event applies to both contacts and companies.
- Core sets each subject's activation timestamp only when it is null; later matches are
  no-ops.
- Company activation is company-grain and contact journey stages remain person-grain, even
  though both use the same configured event.
- Disabling or replacing the setting does not clear or move historical timestamps.
- Preview is historical and read-only. It never saves configuration, materializes
  activation, or emits derived events.
- No public SDK activation helper or client-authoritative lifecycle state is added.
- Existing customer requests remain compatible; `activatedSince`, `activatedAt`, and
  analytics `activated_at` are additive.
- Existing auth precedence, JSON behavior, exit codes, and API error formatting remain
  unchanged.

## Failure behavior

- Missing or blank `--event` fails locally before client creation.
- Event names longer than 191 characters fail locally.
- Invalid preview bounds fail locally.
- Structured Core error envelopes pass through unchanged.
- Unstructured transport and HTTP failures retain the existing `api_error` behavior.
- Tests use mocked clients only and never call a live activation route.

## Rollout

1. Rework draft SDK #164 to the event-name contract. It depends on Core #1663 for the
   routes and runtime behavior.
2. Rework draft Core #1663 to the same contract.
3. Regenerate the SDK OpenAPI document and Core critical fixture from the coordinated schema.
4. Run the exact tool-contract, OpenAPI, and CLI-route drift gates against both final heads.
5. Merge SDK #164 first because Core's unchanged drift workflow validates against SDK
   `main`, then merge Core #1663.
6. Do not use the activation commands until Core #1663 is deployed, and hold stable
   Changesets publication until that deployment.
