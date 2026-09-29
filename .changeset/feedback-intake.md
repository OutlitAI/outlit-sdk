---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Add the `outlit_submit_feedback` tool contract and a matching `outlit feedback` CLI command for authenticated product feedback intake (`body`, optional `area` and `context`). Feedback is product intake — it is rate limited under a dedicated quota, does not consume paid plan API-call quota, and does not open a support ticket or guarantee a reply.
