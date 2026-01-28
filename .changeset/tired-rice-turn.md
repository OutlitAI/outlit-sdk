---
"@outlit/core": minor
"@outlit/node": minor
---

Add fingerprint support for anonymous event tracking

- Add `fingerprint` field to `ServerIdentity`, `IdentifyEvent`, and `IngestPayload`
- Update `validateServerIdentity()` to accept fingerprint as valid identity
- Enable fingerprint-only tracking that can be linked to users later via identify()
