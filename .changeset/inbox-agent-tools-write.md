---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

Add the Inbox write tools to the generated public tool contracts and the OpenAPI document: `outlit_decide_inbox_item` makes a person's own decision on their Inbox tasks by `itemId` (done, won't do, wrong, reopen, snooze, unsnooze, take, put back, not covered) and returns an `undoToken`; `outlit_undo_inbox_decision` reverses it with that token. Rows' `actions` stay empty for now. Outlit turns them on per workspace.
