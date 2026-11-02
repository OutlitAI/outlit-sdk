import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./__tests__/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3456",
    trace: "on-first-retry",
  },

  // Run local server before tests
  webServer: {
    command: "bun run serve:test",
    url: "http://localhost:3456",
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The SDK skips automated browsers, so fixtures run as real visitors:
        // full Chromium (the headless shell reports a "HeadlessChrome" brand)
        // with navigator.webdriver hidden. bot-filter.spec.ts restores the flag.
        channel: "chromium",
        launchOptions: { args: ["--disable-blink-features=AutomationControlled"] },
      },
    },
    // Uncomment to test in more browsers
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },
  ],
})
