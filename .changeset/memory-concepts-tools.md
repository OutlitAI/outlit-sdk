---
"@outlit/tools": minor
"@outlit/cli": patch
"@outlit/pi": patch
---

Add `outlit_list_concepts` to the generated public tool contracts and the OpenAPI document. It lists what customer memory is organized by: the workspace's product features (from its own plans and product data) and the standard topics, each with its aliases, description, parent topic and how many live memory entries carry it, optionally for one customer (`countsLimited` says when a large workspace's counts cover only the most recent entries). `outlit_list_facts` and `outlit_search_customer_context` take an optional `concepts` filter (feature or topic names or aliases; case and plurals don't matter, and a topic includes its subtopics; an unknown name fails with the closest names), and each fact now lists its `concepts`.
