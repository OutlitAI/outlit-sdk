---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Update the `outlit_get_timeline` contract with the additive `productUnavailable` output field, present only when the weekly product usage aggregate cannot be computed; also clarifies that `productDetail:"material"` returns no product rows when the organization has no configured value features while the `product` aggregate still comes back.
