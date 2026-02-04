import { defineConfig } from "tsup"

export default defineConfig([
  // Main vanilla API + React/Vue subpaths (ESM and CJS)
  {
    entry: {
      index: "src/index.ts",
      "react/index": "src/react/index.ts",
      "vue/index": "src/vue/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: true,
    external: ["react", "vue"],
  },
  // IIFE bundle for CDN script tag
  {
    entry: {
      outlit: "src/script.ts",
    },
    format: ["iife"],
    globalName: "Outlit",
    minify: true,
    sourcemap: true,
    clean: false, // Don't clean, already done above
  },
])
