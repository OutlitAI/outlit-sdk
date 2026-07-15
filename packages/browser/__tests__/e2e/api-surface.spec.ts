import { expect, test } from "@playwright/test"

test.describe("Public API surface", () => {
  test("exposes ordinary identity and tracking without authoritative lifecycle or billing methods", async ({
    page,
  }) => {
    await page.goto("/test-page.html")
    await page.waitForFunction(() => window.outlit?._initialized)

    const api = await page.evaluate(() => ({
      hasTrack: typeof window.outlit.track === "function",
      hasIdentify: typeof window.outlit.identify === "function",
      userMethods: Object.keys(window.outlit.user),
      hasCustomerNamespace: "customer" in window.outlit,
    }))

    expect(api).toEqual({
      hasTrack: true,
      hasIdentify: true,
      userMethods: ["identify"],
      hasCustomerNamespace: false,
    })
  })
})
