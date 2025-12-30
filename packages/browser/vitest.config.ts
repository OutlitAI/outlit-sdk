import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["__tests__/unit/**/*.test.{ts,tsx}"],
    globals: true,
  },
})
