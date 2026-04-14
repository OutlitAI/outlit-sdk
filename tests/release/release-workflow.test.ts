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

describe("release workflow CLI dispatch", () => {
  test("uses the repo token with actions write permission for same-repo workflow dispatch", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8")
    const githubTokenExpression = "GH_TOKEN: $" + "{{ github.token }}"

    expect(workflow).toContain("actions: write")
    expect(workflow).toContain(githubTokenExpression)
  })
})

describe("release workflow canary summary", () => {
  test("prints install commands for agent package canaries", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8")

    expect(workflow).toContain("npm install @outlit/tools@canary")
    expect(workflow).toContain("npm install @outlit/pi@canary")
  })
})

describe("CI workflow Pi package coverage", () => {
  test("detects Pi package changes and runs Pi tests", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8")

    expect(workflow).toContain('echo "pi=true"')
    expect(workflow).toContain("steps.changes.outputs.pi == 'true'")
    expect(workflow).toContain("working-directory: packages/pi")
  })
})
