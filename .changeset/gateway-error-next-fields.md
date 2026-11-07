---
"@outlit/tools": minor
---

Gateway error envelopes can carry `next` (the instruction, and optionally the tool and input, for the next call), `missingPermission` on `TOOL_CALL_FORBIDDEN`, and `validValues` on a validation issue. The client keeps an error's envelope when a newer gateway adds fields it doesn't know, dropping only those fields.
