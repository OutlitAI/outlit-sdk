import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    extension: "src/extension.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
})
