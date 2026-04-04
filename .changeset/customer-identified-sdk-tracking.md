---
"@outlit/core": patch
"@outlit/browser": patch
"@outlit/node": patch
---

Introduce the approved customer-identified tracking contract across the SDKs.

- Promote `customerId` and `customerDomain` to top-level public identity fields.
- Keep `identify()` user-scoped while allowing customer metadata via `customerId`, `customerDomain`, and `customerTraits`.
- Allow `track()` to accept user-only, customer-only, or combined attribution.
- Deprecate nested `traits.customer` in favor of top-level customer traits.
