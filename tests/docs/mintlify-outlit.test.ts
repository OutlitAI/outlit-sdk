import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

function readDocsOutlitScript(): string {
  return readFileSync("docs/outlit.js", "utf8")
}

describe("Mintlify Outlit tracking script", () => {
  test("loads the browser SDK for production docs with the dogfood public key", () => {
    const script = readDocsOutlitScript()

    expect(script).toContain('location.hostname !== "docs.outlit.ai"')
    expect(script).toContain("https://cdn.outlit.ai/stable/outlit.js")
    expect(script).toContain("pk_K8WwRMwU8RoMCzcg3Dj25JNoIand-ifg")
  })
})
