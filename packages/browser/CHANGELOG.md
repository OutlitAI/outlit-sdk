# @outlit/browser

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
