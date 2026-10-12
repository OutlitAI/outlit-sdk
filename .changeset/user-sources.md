---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Regenerate tool contracts so each user from `outlit_list_users` and `outlit_get_customer` (with `users`) can say where Outlit found them: an optional `sources` list of `{ system, kind, count, firstSeenAt, lastSeenAt }`. Records (a CRM or support-tool `contact`, a `product_user`, a Slack `chat_member`, a `billing_customer`, a public `profile`) have a null `count`; conversations the person took part in (`call`, `meeting`, `email`, `support_ticket`, `slack_thread`) carry how many and when. The field is additive and optional, so responses from servers that predate it still parse; treat a missing `sources` as unknown, not empty. The CLI docs show the field. Companion to OutlitAI/Core#2957.
