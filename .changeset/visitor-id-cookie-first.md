---
"@outlit/browser": patch
---

Keep one visitor ID across subdomains and Safari's 7-day cookie limit: the browser SDK now reads the shared root-domain cookie before localStorage, restores the cookie from localStorage when it has expired, and refreshes the cookie on every page load. When `apiHost` points at a first-party proxy on the same site, ingest requests ask Outlit to re-issue the visitor cookie from the site's own host.
