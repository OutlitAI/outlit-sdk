#!/usr/bin/env bun
import { $ } from "bun"
import { mkdirSync } from "node:fs"

const targets = [
  { target: "bun-darwin-arm64", out: "dist/outlit-darwin-arm64" },
  { target: "bun-darwin-x64", out: "dist/outlit-darwin-x64" },
  { target: "bun-linux-x64", out: "dist/outlit-linux-x64" },
  { target: "bun-linux-arm64", out: "dist/outlit-linux-arm64" },
  { target: "bun-windows-x64", out: "dist/outlit-windows-x64.exe" },
]

mkdirSync("dist", { recursive: true })

for (const { target, out } of targets) {
  console.log(`Building ${target}...`)
  await $`bun build --compile --minify --sourcemap --bytecode src/cli.ts --target=${target} --outfile ${out}`
}

console.log("All binaries built in dist/")
