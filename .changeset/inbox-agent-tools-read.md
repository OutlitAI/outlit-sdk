---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

Add the Inbox read tools to the generated public tool contracts and the OpenAPI document: `outlit_list_inbox` lists one section of a person's Inbox (today, open, snoozed, done or pool) with an opaque `itemId` per item, and `outlit_get_inbox_item` reads one item by that id with its source preview, prepared reply and covered steps. Outlit turns them on per workspace.
