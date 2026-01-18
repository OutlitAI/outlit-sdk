---
"@outlit/browser": major
"@outlit/node": major
"@outlit/core": minor
---

feat: add user and customer namespaces for stage and billing events

BREAKING CHANGE: Stage and billing methods are now accessed via namespaces.

**Before:**
```ts
outlit.activate({ milestone: 'onboarding' })
outlit.engaged({ days: 7 })
outlit.paid({ plan: 'pro' })
outlit.churned({ reason: 'cancelled' })
```

**After:**
```ts
// User journey stages
outlit.user.activate({ milestone: 'onboarding' })
outlit.user.engaged({ days: 7 })
outlit.user.inactive({ reason: 'no_activity' })

// Customer billing status (requires identifier)
outlit.customer.trialing({ domain: 'acme.com' })
outlit.customer.paid({ domain: 'acme.com', properties: { plan: 'pro' } })
outlit.customer.churned({ stripeCustomerId: 'cus_xxx', properties: { reason: 'cancelled' } })
```

**Other changes:**
- Add type constraints: `ServerIdentity` requires email or userId
- Add type constraints: `CustomerIdentifier` requires customerId, stripeCustomerId, or domain
- Add warning logs for URL parsing failures
- Add sendBeacon fallback warning and response.ok check
- Fix JSDoc import path in node client
