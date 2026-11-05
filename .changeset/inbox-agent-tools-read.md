---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

Add the Inbox read tools to the generated public tool contracts and the OpenAPI document: `outlit_list_inbox` lists one section of a person's Inbox (today, open, snoozed, done or pool) as tasks, each with its task `itemId`, what it asks, what it is part of, its customer and what it answers; `outlit_get_inbox_item` reads one task by that id with its source preview, prepared reply and covered tasks. Outlit turns them on per workspace.
