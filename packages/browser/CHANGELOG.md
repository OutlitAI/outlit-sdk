# @outlit/browser

## 1.5.0

### Minor Changes

- [#82](https://github.com/OutlitAI/outlit-sdk/pull/82) [`60a4633`](https://github.com/OutlitAI/outlit-sdk/commit/60a4633974467505afae0dd62fd79de93861a292) Thanks [@leo-paz](https://github.com/leo-paz)! - Remove the public `customerDomain` tracking field from the SDK surface and make `customerId` plus identify-time email linking the only supported customer-attribution path.

### Patch Changes

- Updated dependencies [[`60a4633`](https://github.com/OutlitAI/outlit-sdk/commit/60a4633974467505afae0dd62fd79de93861a292)]:
  - @outlit/core@1.5.0

## 1.4.5

### Patch Changes

- [#78](https://github.com/OutlitAI/outlit-sdk/pull/78) [`d2f7b68`](https://github.com/OutlitAI/outlit-sdk/commit/d2f7b684ad67945647a4e2b019e1bf4435a033da) Thanks [@leo-paz](https://github.com/leo-paz)! - Introduce the approved customer-identified tracking contract across the SDKs.

  - Promote `customerId` and `customerDomain` to top-level public identity fields.
  - Keep `identify()` user-scoped while allowing customer metadata via `customerId`, `customerDomain`, and `customerTraits`.
  - Allow `track()` to accept user-only, customer-only, or combined attribution.
  - Deprecate nested `traits.customer` in favor of top-level customer traits.

- [#79](https://github.com/OutlitAI/outlit-sdk/pull/79) [`31dc72a`](https://github.com/OutlitAI/outlit-sdk/commit/31dc72a4d1c8b6424bb3cde3584baf8b455c0974) Thanks [@leo-paz](https://github.com/leo-paz)! - Stop sending user and customer profile traits in payload-level browser identity on non-identify event batches. Profile updates now stay on identify events, while later track batches carry only attribution identifiers.

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

## 1.4.1

### Patch Changes

- [#46](https://github.com/OutlitAI/outlit-sdk/pull/46) [`32e8206`](https://github.com/OutlitAI/outlit-sdk/commit/32e8206f3f807d6773adff42d012225fb77f0fe4) Thanks [@leo-paz](https://github.com/leo-paz)! - Fix auto-identify for forms where email inputs lack a `name` attribute. React/JSX controlled components often omit name attributes, causing FormData to miss their values. Now reads unnamed inputs directly from the DOM during identity extraction so auto-identify works on these forms.

## 1.4.0

### Minor Changes

- [#44](https://github.com/OutlitAI/outlit-sdk/pull/44) [`778f449`](https://github.com/OutlitAI/outlit-sdk/commit/778f44982e2168c40804d5cc2c442249b5b7cba5) Thanks [@leo-paz](https://github.com/leo-paz)! - Add `client` prop to `OutlitProvider` for sharing a single Outlit instance between imperative usage and React context. When provided, the provider uses the existing instance directly and does not call `shutdown()` on unmount. Uses a discriminated union type to enforce mutual exclusivity with config props at compile time.

## 1.3.0

### Minor Changes

- [#42](https://github.com/OutlitAI/outlit-sdk/pull/42) [`bde5685`](https://github.com/OutlitAI/outlit-sdk/commit/bde5685b0f1cd61768b0278e3e7e9410b3888530) Thanks [@leo-paz](https://github.com/leo-paz)! - Add `disableTracking()` method and consent state persistence

  - `disableTracking()` programmatically stops all tracking, flushes pending events, and persists the opt-out decision
  - Consent decisions (opt-in/opt-out) are persisted across sessions via localStorage and cookies
  - On page load, persisted consent takes priority over the `autoTrack` option
  - `disableTracking` exposed via React `useOutlit()` hook and Vue `useOutlit()` composable
  - CDN snippet updated to support `disableTracking` queuing before SDK loads

## 1.2.0

### Minor Changes

- [#39](https://github.com/OutlitAI/outlit-sdk/pull/39) [`788b6b5`](https://github.com/OutlitAI/outlit-sdk/commit/788b6b58ebab4477399d8d424cea708326291d79) Thanks [@leo-paz](https://github.com/leo-paz)! - Add Vue 3 support with plugin and composables

  - `OutlitPlugin` for easy Vue app installation with automatic pageview tracking
  - `useOutlit` composable for accessing the Outlit instance
  - `useOutlitUser` composable for reactive user identity sync
  - `useTrack` composable for event tracking
  - New `@outlit/browser/vue` entry point

## 1.1.0

### Patch Changes

- Updated dependencies [[`4404a04`](https://github.com/OutlitAI/outlit-sdk/commit/4404a04739e5a8b3de7e077ae39aa9c9daa01abf), [`09b09d6`](https://github.com/OutlitAI/outlit-sdk/commit/09b09d6ba718c34244215e9c2a6891f7ec30e5b9)]:
  - @outlit/core@1.1.0

## 1.0.4

### Patch Changes

- [#27](https://github.com/OutlitAI/outlit-sdk/pull/27) [`dc430ec`](https://github.com/OutlitAI/outlit-sdk/commit/dc430ec4750f240350dd298a8f142f5e57531664) Thanks [@leo-paz](https://github.com/leo-paz)! - Fix race condition where stage events (activate, engaged, inactive) were silently dropped when called before user identity was established. Events are now queued and flushed when setUser() or identify() is called.

## 1.0.3

### Patch Changes

- [#25](https://github.com/OutlitAI/outlit-sdk/pull/25) [`066f8d3`](https://github.com/OutlitAI/outlit-sdk/commit/066f8d31032f75f913aea094a332215c45369bd5) Thanks [@leo-paz](https://github.com/leo-paz)! - Update E2E test fixtures to use new namespace-based IIFE stub pattern with user and customer namespaces

## 1.0.2

### Patch Changes

- [#23](https://github.com/OutlitAI/outlit-sdk/pull/23) [`22be5d0`](https://github.com/OutlitAI/outlit-sdk/commit/22be5d01bdd639d2d4621543340415c1333814ce) Thanks [@leo-paz](https://github.com/leo-paz)! - Update the script tag stub snippet to use a helper for cleaner method stubs.

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

## 0.4.1

### Patch Changes

- [#17](https://github.com/OutlitAI/outlit-sdk/pull/17) [`7c11805`](https://github.com/OutlitAI/outlit-sdk/commit/7c11805290b20d71c524e0c79522f77bf9c44db8) Thanks [@rafa-thayto](https://github.com/rafa-thayto)! - Add typesVersions for legacy moduleResolution support

## 0.4.0

### Minor Changes

- [#14](https://github.com/OutlitAI/outlit-sdk/pull/14) [`3feb1db`](https://github.com/OutlitAI/outlit-sdk/commit/3feb1dbbbd7dc73b0b7b6cd8bc3060a878ed1c73) Thanks [@leo-paz](https://github.com/leo-paz)! - Add sessionId to all browser events at the batch level, enabling session tracking from pageviews, forms, and custom events (not just engagement). Session tracking is now always initialized for sessionId management, even when engagement events are disabled.

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
