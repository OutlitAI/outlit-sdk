---
"@outlit/tools": patch
"@outlit/cli": patch
---

Normalize customer context source type inputs case-insensitively so CRM, CRM_OPPORTUNITY, and OPPORTUNITY filters all resolve to the canonical OPPORTUNITY source type before CLI and SDK helper requests are sent.
