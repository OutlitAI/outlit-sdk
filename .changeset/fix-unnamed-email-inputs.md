---
"@outlit/browser": patch
---

Fix auto-identify for forms where email inputs lack a `name` attribute. React/JSX controlled components often omit name attributes, causing FormData to miss their values. Now reads unnamed inputs directly from the DOM during identity extraction so auto-identify works on these forms.
