---
"@outlit/browser": minor
---

Skip sending events from crawlers and automated browsers. The browser SDK now drops events when `navigator.webdriver` is set, when headless Chrome is detected, or when the user agent matches common JavaScript-executing crawlers (Googlebot, Bingbot, GPTBot, ClaudeBot, Lighthouse, link unfurlers). Set `botFilter: false` (or `data-bot-filter="false"` on the script tag) to send them, for example in your own end-to-end tests.
