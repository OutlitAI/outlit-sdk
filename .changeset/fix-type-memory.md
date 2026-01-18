---
"@outlit/core": patch
"@outlit/browser": patch
"@outlit/node": patch
---

fix: simplify SDK types to resolve TypeScript memory issues

- Simplify `ServerIdentity` and `CustomerIdentifier` types to avoid complex unions that caused TypeScript to require 8GB+ memory for type checking
- Make `domain` required in `CustomerIdentifier` - users must now provide domain when calling billing methods (`customer.trialing`, `customer.paid`, `customer.churned`)
- Type checking now completes in ~1 second with normal memory usage
