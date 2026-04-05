# @outlit/node

## 1.4.5

### Patch Changes

- [#78](https://github.com/OutlitAI/outlit-sdk/pull/78) [`d2f7b68`](https://github.com/OutlitAI/outlit-sdk/commit/d2f7b684ad67945647a4e2b019e1bf4435a033da) Thanks [@leo-paz](https://github.com/leo-paz)! - Introduce the approved customer-identified tracking contract across the SDKs.

  - Promote `customerId` and `customerDomain` to top-level public identity fields.
  - Keep `identify()` user-scoped while allowing customer metadata via `customerId`, `customerDomain`, and `customerTraits`.
  - Allow `track()` to accept user-only, customer-only, or combined attribution.
  - Deprecate nested `traits.customer` in favor of top-level customer traits.

- [#80](https://github.com/OutlitAI/outlit-sdk/pull/80) [`9c99955`](https://github.com/OutlitAI/outlit-sdk/commit/9c999559c0c98a7b974d77298ad8fcf636b7c681) Thanks [@leo-paz](https://github.com/leo-paz)! - Serialize browser batch customer attribution into top-level `customerIdentity` instead of nesting customer fields under `userIdentity`. This aligns the browser SDK with the platform ingest schema while keeping identify events customer-aware.

- Updated dependencies [[`d2f7b68`](https://github.com/OutlitAI/outlit-sdk/commit/d2f7b684ad67945647a4e2b019e1bf4435a033da), [`9c99955`](https://github.com/OutlitAI/outlit-sdk/commit/9c999559c0c98a7b974d77298ad8fcf636b7c681)]:
  - @outlit/core@1.4.5

## 1.4.4

### Patch Changes

- [#72](https://github.com/OutlitAI/outlit-sdk/pull/72) [`06bd548`](https://github.com/OutlitAI/outlit-sdk/commit/06bd54886a254b42ba76d354c401022abd9cc0c0) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add integrations commands (list, add, remove, status) with API-key and OAuth provider flows

- Updated dependencies [[`06bd548`](https://github.com/OutlitAI/outlit-sdk/commit/06bd54886a254b42ba76d354c401022abd9cc0c0)]:
  - @outlit/core@1.4.4

## 1.4.3

### Patch Changes

- [#67](https://github.com/OutlitAI/outlit-sdk/pull/67) [`e8c4779`](https://github.com/OutlitAI/outlit-sdk/commit/e8c4779ed85d4639e09245727c3494ca093cdc6a) Thanks [@leo-paz](https://github.com/leo-paz)! - fix: replace workspace:\* with concrete version ranges to prevent protocol leak during npm publish

- Updated dependencies [[`86db798`](https://github.com/OutlitAI/outlit-sdk/commit/86db798a7d309830c249a337f35ad49c66fb726b)]:
  - @outlit/core@1.4.3

## 1.4.2

### Patch Changes

- [#63](https://github.com/OutlitAI/outlit-sdk/pull/63) [`c9015e4`](https://github.com/OutlitAI/outlit-sdk/commit/c9015e4254f4766f6a49c846e66bc299fe475b41) Thanks [@leo-paz](https://github.com/leo-paz)! - Prevent infinite flush retry loops on non-retryable ingest errors.

  `@outlit/node` now classifies transport failures and only retries transient errors
  (network/timeouts, `429`, and `5xx`). Non-retryable API errors such as invalid or
  inactive tracking configuration (`400`) no longer get re-queued forever, and periodic
  auto-flush retries are disabled after the first fatal non-retryable failure.

## 1.1.0

### Minor Changes

- [#35](https://github.com/OutlitAI/outlit-sdk/pull/35) [`09b09d6`](https://github.com/OutlitAI/outlit-sdk/commit/09b09d6ba718c34244215e9c2a6891f7ec30e5b9) Thanks [@leo-paz](https://github.com/leo-paz)! - Add fingerprint support for anonymous event tracking

  - Add `fingerprint` field to `ServerIdentity`, `IdentifyEvent`, and `IngestPayload`
  - Update `validateServerIdentity()` to accept fingerprint as valid identity
  - Enable fingerprint-only tracking that can be linked to users later via identify()

### Patch Changes

- Updated dependencies [[`4404a04`](https://github.com/OutlitAI/outlit-sdk/commit/4404a04739e5a8b3de7e077ae39aa9c9daa01abf), [`09b09d6`](https://github.com/OutlitAI/outlit-sdk/commit/09b09d6ba718c34244215e9c2a6891f7ec30e5b9)]:
  - @outlit/core@1.1.0

## 1.0.1

### Patch Changes

- [#21](https://github.com/OutlitAI/outlit-sdk/pull/21) [`ae24b74`](https://github.com/OutlitAI/outlit-sdk/commit/ae24b74b0d6871b06885de64a1ff75044a99b5d0) Thanks [@leo-paz](https://github.com/leo-paz)! - fix: simplify SDK types to resolve TypeScript memory issues

  - Simplify `ServerIdentity` and `CustomerIdentifier` types to avoid complex unions that caused TypeScript to require 8GB+ memory for type checking
  - Make `domain` required in `CustomerIdentifier` - users must now provide domain when calling billing methods (`customer.trialing`, `customer.paid`, `customer.churned`)
  - Type checking now completes in ~1 second with normal memory usage

- Updated dependencies [[`ae24b74`](https://github.com/OutlitAI/outlit-sdk/commit/ae24b74b0d6871b06885de64a1ff75044a99b5d0)]:
  - @outlit/core@1.0.1

## 1.0.0

### Major Changes

- [#19](https://github.com/OutlitAI/outlit-sdk/pull/19) [`6d95b23`](https://github.com/OutlitAI/outlit-sdk/commit/6d95b233d0e0f189dfef836b76e35ef775fa4e39) Thanks [@leo-paz](https://github.com/leo-paz)! - feat: add user and customer namespaces for stage and billing events

  BREAKING CHANGE: Stage and billing methods are now accessed via namespaces.

  **Before:**

  ```ts
  outlit.activate({ milestone: "onboarding" });
  outlit.engaged({ days: 7 });
  outlit.paid({ plan: "pro" });
  outlit.churned({ reason: "cancelled" });
  ```

  **After:**

  ```ts
  // User journey stages
  outlit.user.activate({ milestone: "onboarding" });
  outlit.user.engaged({ days: 7 });
  outlit.user.inactive({ reason: "no_activity" });

  // Customer billing status (requires identifier)
  outlit.customer.trialing({ domain: "acme.com" });
  outlit.customer.paid({ domain: "acme.com", properties: { plan: "pro" } });
  outlit.customer.churned({
    stripeCustomerId: "cus_xxx",
    properties: { reason: "cancelled" },
  });
  ```

  **Other changes:**

  - Add type constraints: `ServerIdentity` requires email or userId
  - Add type constraints: `CustomerIdentifier` requires customerId, stripeCustomerId, or domain
  - Add warning logs for URL parsing failures
  - Add sendBeacon fallback warning and response.ok check
  - Fix JSDoc import path in node client

### Patch Changes

- Updated dependencies [[`6d95b23`](https://github.com/OutlitAI/outlit-sdk/commit/6d95b233d0e0f189dfef836b76e35ef775fa4e39)]:
  - @outlit/core@1.0.0

## 0.4.0

### Patch Changes

- Updated dependencies [[`3feb1db`](https://github.com/OutlitAI/outlit-sdk/commit/3feb1dbbbd7dc73b0b7b6cd8bc3060a878ed1c73)]:
  - @outlit/core@0.4.0

## 0.3.0

### Minor Changes

- [`e09ca38`](https://github.com/OutlitAI/outlit-sdk/commit/e09ca38da6373c961cc572cc05a792922a6150f6) Thanks [@leo-paz](https://github.com/leo-paz)! - New sdk events for discovered, signed up, activated, engaged, paid, churned

### Patch Changes

- Updated dependencies [[`e09ca38`](https://github.com/OutlitAI/outlit-sdk/commit/e09ca38da6373c961cc572cc05a792922a6150f6)]:
  - @outlit/core@0.3.0

## 0.2.2

### Patch Changes

- [#9](https://github.com/OutlitAI/outlit-sdk/pull/9) [`754f4ab`](https://github.com/OutlitAI/outlit-sdk/commit/754f4abfe8930675bcd5bf802cf58e2a7fb33b52) Thanks [@leo-paz](https://github.com/leo-paz)! - Testing new release workflow

- Updated dependencies [[`754f4ab`](https://github.com/OutlitAI/outlit-sdk/commit/754f4abfe8930675bcd5bf802cf58e2a7fb33b52)]:
  - @outlit/core@0.2.2

## 0.2.1

### Patch Changes

- [#3](https://github.com/OutlitAI/outlit-sdk/pull/3) [`26ff67c`](https://github.com/OutlitAI/outlit-sdk/commit/26ff67c7f595a774af1ced95fd78ba813ffcecc9) Thanks [@leo-paz](https://github.com/leo-paz)! - changing github workflows

- Updated dependencies [[`26ff67c`](https://github.com/OutlitAI/outlit-sdk/commit/26ff67c7f595a774af1ced95fd78ba813ffcecc9)]:
  - @outlit/core@0.2.1

## 0.2.0

### Minor Changes

- [`7caf611`](https://github.com/OutlitAI/outlit-sdk/commit/7caf6112c80c1c34b41b24a3a4e10a29a66fe678) Thanks [@leo-paz](https://github.com/leo-paz)! - initial sdk packages with github ci/cd

### Patch Changes

- Updated dependencies [[`7caf611`](https://github.com/OutlitAI/outlit-sdk/commit/7caf6112c80c1c34b41b24a3a4e10a29a66fe678)]:
  - @outlit/core@0.2.0
