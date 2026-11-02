---
"@outlit/browser": minor
---

Tag traffic from automated browsers instead of dropping it. The browser SDK sends every event, and when it detects automation that only the browser can see (`navigator.webdriver` from Playwright, Puppeteer, or Selenium, or headless Chrome), it adds a `traffic` hint to the batch. Outlit classifies all browser traffic server-side as human, AI agent, crawler, or automation, so bot and AI-agent visits stay visible and distinguishable.
