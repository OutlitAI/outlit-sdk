---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

Add the Inbox write tools to the generated public tool contracts and the OpenAPI document: `outlit_act_on_inbox_item` takes a person's own action on one Inbox task by `itemId` (done, won't do, wrong, reopen, snooze, unsnooze, take, put back, not covered) and returns an `undoToken`; `outlit_undo_inbox_action` reverses it with that token. Rows' `actions` stay empty for now. Outlit turns them on per workspace.
