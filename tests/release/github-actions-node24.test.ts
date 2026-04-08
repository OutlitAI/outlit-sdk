import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

function readWorkflow(path: string): string {
  return readFileSync(path, "utf8")
}

describe("GitHub Actions Node 24 upgrade", () => {
  test("upgrades CI workflow actions and forces Node 24 action runtime", () => {
    const workflow = readWorkflow(".github/workflows/ci.yml")

    expect(workflow).toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true")
    expect(workflow).toContain("uses: actions/checkout@v6")
    expect(workflow).toContain("uses: actions/setup-node@v6")
  })

  test("upgrades release workflow actions and forces Node 24 action runtime", () => {
    const workflow = readWorkflow(".github/workflows/release.yml")

    expect(workflow).toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true")
    expect(workflow).toContain("uses: actions/checkout@v6")
    expect(workflow).toContain("uses: actions/setup-node@v6")
    expect(workflow).toContain("uses: google-github-actions/auth@v3")
    expect(workflow).toContain("uses: google-github-actions/setup-gcloud@v3")
  })

  test("upgrades rust release checkout action and forces Node 24 action runtime", () => {
    const workflow = readWorkflow(".github/workflows/rust-release.yml")

    expect(workflow).toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true")
    expect(workflow).toContain("uses: actions/checkout@v6")
  })

  test("upgrades release-cli checkout action and forces Node 24 action runtime", () => {
    const workflow = readWorkflow(".github/workflows/release-cli.yml")

    expect(workflow).toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true")
    expect(workflow).toContain("uses: actions/checkout@v6")
  })
})
