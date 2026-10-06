---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Sync the API key validation contract v2 from Core: `apiKeyContractHeader` and `apiKeyValidationSuccessSchemaV2` add `apiKey.expiresAt`, returned only when a client sends `Outlit-Api-Key-Contract: 2`. The CLI now asks for v2 when it validates a key, still accepts v1 responses, and warns on stderr (once per run) when the key expires within 14 days, suggesting `outlit login`.
