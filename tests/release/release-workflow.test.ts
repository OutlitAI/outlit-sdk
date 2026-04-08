import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

describe("release workflow canary order", () => {
  test("creates canary snapshot versions before building publish artifacts", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8")

    const buildIndex = workflow.indexOf("- name: Build")
    const snapshotIndex = workflow.indexOf("- name: Create canary snapshot versions")

    expect(snapshotIndex).toBeGreaterThanOrEqual(0)
    expect(buildIndex).toBeGreaterThanOrEqual(0)
    expect(snapshotIndex).toBeLessThan(buildIndex)
  })
})
