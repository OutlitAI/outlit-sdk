---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Update the `outlit_get_timeline` contract for compact-by-default reads: optional `includeMetadata` and `productDetail` ("none" | "material" | "raw") inputs, optional `product` weekly usage aggregate in the output, required `pagination.effectiveLimit`, and `metadata` now optional on timeline events. Companion to Core#2285.
