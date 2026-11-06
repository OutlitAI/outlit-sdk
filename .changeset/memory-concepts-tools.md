---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

Add `outlit_list_concepts` to the generated public tool contracts and the OpenAPI document. It lists the concepts customer memory is organized by (the workspace's product features and the standard topics), each with its aliases, description, parent concept and how many live memory entries carry it, optionally for one customer (`countsLimited` says when a large workspace's counts cover only the most recent entries). `outlit_list_facts` and `outlit_search_customer_context` take an optional `concepts` filter (concept names or aliases; case and plurals don't matter, and a concept includes the concepts under it; an unknown name fails with the closest names), and each fact now lists its `concepts`.
