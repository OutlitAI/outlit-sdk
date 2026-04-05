---
"@outlit/browser": patch
---

Stop sending user and customer profile traits in payload-level browser identity on non-identify event batches. Profile updates now stay on identify events, while later track batches carry only attribution identifiers.
