# @outlit/core

## 1.1.0

### Minor Changes

- [#29](https://github.com/OutlitAI/outlit-sdk/pull/29) [`4404a04`](https://github.com/OutlitAI/outlit-sdk/commit/4404a04739e5a8b3de7e077ae39aa9c9daa01abf) Thanks [@leo-paz](https://github.com/leo-paz)! - Add `CustomerTraits` and `IdentifyTraits` type exports for nested customer properties in identify calls

- [#35](https://github.com/OutlitAI/outlit-sdk/pull/35) [`09b09d6`](https://github.com/OutlitAI/outlit-sdk/commit/09b09d6ba718c34244215e9c2a6891f7ec30e5b9) Thanks [@leo-paz](https://github.com/leo-paz)! - Add fingerprint support for anonymous event tracking

  - Add `fingerprint` field to `ServerIdentity`, `IdentifyEvent`, and `IngestPayload`
  - Update `validateServerIdentity()` to accept fingerprint as valid identity
  - Enable fingerprint-only tracking that can be linked to users later via identify()

## 1.0.1

### Patch Changes

- [#21](https://github.com/OutlitAI/outlit-sdk/pull/21) [`ae24b74`](https://github.com/OutlitAI/outlit-sdk/commit/ae24b74b0d6871b06885de64a1ff75044a99b5d0) Thanks [@leo-paz](https://github.com/leo-paz)! - fix: simplify SDK types to resolve TypeScript memory issues

  - Simplify `ServerIdentity` and `CustomerIdentifier` types to avoid complex unions that caused TypeScript to require 8GB+ memory for type checking
  - Make `domain` required in `CustomerIdentifier` - users must now provide domain when calling billing methods (`customer.trialing`, `customer.paid`, `customer.churned`)
  - Type checking now completes in ~1 second with normal memory usage

## 1.0.0

### Minor Changes

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

## 0.4.0

### Minor Changes

- [#14](https://github.com/OutlitAI/outlit-sdk/pull/14) [`3feb1db`](https://github.com/OutlitAI/outlit-sdk/commit/3feb1dbbbd7dc73b0b7b6cd8bc3060a878ed1c73) Thanks [@leo-paz](https://github.com/leo-paz)! - Add sessionId to all browser events at the batch level, enabling session tracking from pageviews, forms, and custom events (not just engagement). Session tracking is now always initialized for sessionId management, even when engagement events are disabled.

## 0.3.0

### Minor Changes

- [`e09ca38`](https://github.com/OutlitAI/outlit-sdk/commit/e09ca38da6373c961cc572cc05a792922a6150f6) Thanks [@leo-paz](https://github.com/leo-paz)! - New sdk events for discovered, signed up, activated, engaged, paid, churned

## 0.2.2

### Patch Changes

- [#9](https://github.com/OutlitAI/outlit-sdk/pull/9) [`754f4ab`](https://github.com/OutlitAI/outlit-sdk/commit/754f4abfe8930675bcd5bf802cf58e2a7fb33b52) Thanks [@leo-paz](https://github.com/leo-paz)! - Testing new release workflow

## 0.2.1

### Patch Changes

- [#3](https://github.com/OutlitAI/outlit-sdk/pull/3) [`26ff67c`](https://github.com/OutlitAI/outlit-sdk/commit/26ff67c7f595a774af1ced95fd78ba813ffcecc9) Thanks [@leo-paz](https://github.com/leo-paz)! - changing github workflows

## 0.2.0

### Minor Changes

- [`7caf611`](https://github.com/OutlitAI/outlit-sdk/commit/7caf6112c80c1c34b41b24a3a4e10a29a66fe678) Thanks [@leo-paz](https://github.com/leo-paz)! - initial sdk packages with github ci/cd
