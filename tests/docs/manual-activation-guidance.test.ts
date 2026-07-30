import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

function read(path: string): string {
  return readFileSync(path, "utf8")
}

describe("manual activation migration guidance", () => {
  test("describes activation as tracking the configured meaningful event", () => {
    const nuxtGuide = read("docs/tracking/browser/nuxt.mdx")

    expect(nuxtGuide).not.toContain("Mark activation after")
    expect(nuxtGuide).toContain(
      "Track the configured meaningful event after the user completes the milestone:",
    )
  })

  test("documents the Rust 0.2 to 0.3 migration", () => {
    const changelog = read("crates/outlit/CHANGELOG.md")

    expect(changelog).toContain("### Migration from 0.2")
    expect(changelog).toContain(
      'replace `client.user().activate(...)` with `client.track("your_configured_event", identity)`',
    )
    expect(changelog).toContain("configured meaningful product event")
  })

  test("installs the pending breaking Rust release line", () => {
    const readme = read("crates/outlit/README.md")

    expect(readme).toContain('outlit = "0.3"')
    expect(readme).not.toContain('outlit = "0.2"')
  })
})
