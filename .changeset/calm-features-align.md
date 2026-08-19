---
"@outlit/cli": major
"@outlit/tools": major
"@outlit/pi": major
---

Replace the public Behavior Metric and Value Feature surfaces with one canonical Feature lifecycle.
Use `outlit features list|create|archive` and `outlit customers features`; the generated public tools
are `outlit_list_features`, `outlit_create_feature`, `outlit_archive_feature`, and
`outlit_get_customer_features`. Creating a Feature still atomically creates the supporting weekly
event-count and active-days metrics inside Outlit.
