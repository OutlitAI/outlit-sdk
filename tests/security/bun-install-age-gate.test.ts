import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const repoRoot = path.resolve(import.meta.dir, "../..")
const requiredMinimumReleaseAgeSeconds = 24 * 60 * 60
const ignoredDirectories = new Set([".git", ".turbo", "coverage", "dist", "node_modules"])

function findBunfigs(directory: string): string[] {
  const bunfigs: string[] = []

  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry)
    const stats = statSync(entryPath)

    if (stats.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        bunfigs.push(...findBunfigs(entryPath))
      }
      continue
    }

    if (entry === "bunfig.toml") {
      bunfigs.push(entryPath)
    }
  }

  return bunfigs
}

describe("Bun install minimum release age", () => {
  test("requires every repo Bun install config to guard new packages for 24 hours", () => {
    const rootBunfigPath = path.join(repoRoot, "bunfig.toml")
    const failures: string[] = []

    if (!existsSync(rootBunfigPath)) {
      failures.push("bunfig.toml is missing")
    }

    for (const bunfigPath of findBunfigs(repoRoot)) {
      const relativePath = path.relative(repoRoot, bunfigPath)
      const config = Bun.TOML.parse(readFileSync(bunfigPath, "utf8")) as {
        install?: { minimumReleaseAge?: number }
      }
      const minimumReleaseAge = config.install?.minimumReleaseAge

      if (minimumReleaseAge !== requiredMinimumReleaseAgeSeconds) {
        failures.push(
          `${relativePath} install.minimumReleaseAge is ${minimumReleaseAge ?? "unset"}`,
        )
      }
    }

    expect(failures).toEqual([])
  })
})
