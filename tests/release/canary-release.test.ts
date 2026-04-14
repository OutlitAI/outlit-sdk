import { describe, expect, test } from "bun:test"
import { getCanaryReleaseMetadata } from "../../.github/scripts/canary-release.mjs"

describe("getCanaryReleaseMetadata", () => {
  test("accepts a CLI-only snapshot without requiring a browser snapshot", () => {
    const metadata = getCanaryReleaseMetadata({
      "@outlit/browser": "1.4.5",
      "@outlit/cli": "1.5.0-canary-202604080240-abcd123",
      "@outlit/core": "1.4.5",
      "@outlit/node": "1.4.5",
    })

    expect(metadata.hasSnapshots).toBe(true)
    expect(metadata.hasBrowserSnapshot).toBe(false)
    expect(metadata.snapshotPackages.map((pkg) => pkg.name)).toEqual(["@outlit/cli"])
    expect(metadata.snapshotPackages[0]).toMatchObject({
      name: "@outlit/cli",
      installCommand: "npm install @outlit/cli@canary",
    })
  })

  test("flags browser snapshots so CDN deploy can stay conditional", () => {
    const metadata = getCanaryReleaseMetadata({
      "@outlit/browser": "1.4.6-canary-202604080240-abcd123",
      "@outlit/cli": "1.4.1",
      "@outlit/core": "1.4.6-canary-202604080240-abcd123",
      "@outlit/node": "1.4.6-canary-202604080240-abcd123",
    })

    expect(metadata.hasSnapshots).toBe(true)
    expect(metadata.hasBrowserSnapshot).toBe(true)
    expect(metadata.snapshotPackages.map((pkg) => pkg.name)).toEqual([
      "@outlit/browser",
      "@outlit/core",
      "@outlit/node",
    ])
  })

  test("fails the guard only when no package has a canary snapshot version", () => {
    const metadata = getCanaryReleaseMetadata({
      "@outlit/browser": "1.4.5",
      "@outlit/cli": "1.4.1",
      "@outlit/core": "1.4.5",
      "@outlit/node": "1.4.5",
    })

    expect(metadata.hasSnapshots).toBe(false)
    expect(metadata.snapshotPackages).toEqual([])
  })

  test("includes tools and Pi snapshots in canary metadata", () => {
    const metadata = getCanaryReleaseMetadata({
      "@outlit/browser": "1.5.0",
      "@outlit/cli": "1.5.0",
      "@outlit/core": "1.5.0",
      "@outlit/node": "1.5.0",
      "@outlit/pi": "0.0.0-canary-202604080240-abcd123",
      "@outlit/tools": "0.0.0-canary-202604080240-abcd123",
    })

    expect(metadata.hasSnapshots).toBe(true)
    expect(metadata.hasBrowserSnapshot).toBe(false)
    expect(metadata.snapshotPackages.map((pkg) => pkg.name)).toEqual([
      "@outlit/tools",
      "@outlit/pi",
    ])
    expect(metadata.snapshotPackages.map((pkg) => pkg.installCommand)).toEqual([
      "npm install @outlit/tools@canary",
      "npm install @outlit/pi@canary",
    ])
  })
})
