---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Update the `outlit_list_sources` contract for compact hosted pagination: `pagination` gains a required `effectiveLimit` integer describing the maximum number of items a page can contain, so hosted callers that receive byte-trimmed pages can rely on `hasMore`/`nextCursor` rather than item count. Regeneration also removes the `unreadable`/`unreadableReason` timeline event fields and restores the unconditional `sourceRef` description, realigning the generated contract with Core `main` (those fields land with their own companion when the matching Core change merges). Companion to the Core tool-access and listing fixes.
