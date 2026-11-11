---
"@outlit/cli": patch
---

`outlit search --limit` takes 1 to 100 with a default of 25, as the tool's contract says (help and validation said 1 to 50 and 20). The list commands that defaulted to 20 (`customers list`, `people list`, `members list`, `destinations list`, `features list`) now default to 25. The page sizes are read from the generated contracts.
