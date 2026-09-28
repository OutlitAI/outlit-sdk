import { createHash } from "node:crypto"
import { describe, expect, test } from "vitest"
import { buildSnapshot, contentsMatch } from "../../scripts/sync-outlit-skill.mjs"

const source = `---
name: outlit
description: Agent guidance.
---

# Outlit

Read [identity](references/identity.md) and [SQL](references/sql-reference.md).
`
const revision = "a".repeat(40)
const files = {
  "skills/outlit/SKILL.md": source,
  "skills/outlit/references/identity.md": "# Identity\n",
  "skills/outlit/references/sql-reference.md": "# SQL\n",
}
const digest = (value) => createHash("sha256").update(value).digest("hex")

describe("canonical Outlit docs skill snapshot", () => {
  test("preserves skill prose and pins both references to the same revision", () => {
    const snapshot = buildSnapshot(revision, files)

    expect(snapshot.skill).toBe(
      source
        .replace(
          "references/identity.md",
          `https://raw.githubusercontent.com/OutlitAI/skills/${revision}/skills/outlit/references/identity.md`,
        )
        .replace(
          "references/sql-reference.md",
          `https://raw.githubusercontent.com/OutlitAI/skills/${revision}/skills/outlit/references/sql-reference.md`,
        ),
    )
    expect(snapshot.manifest.files).toEqual({
      "skills/outlit/SKILL.md": digest(source),
      "skills/outlit/references/identity.md": digest("# Identity\n"),
      "skills/outlit/references/sql-reference.md": digest("# SQL\n"),
    })
  })

  test("does not refresh when only upstream revision changes", () => {
    const existing = buildSnapshot(revision, files)
    const latest = buildSnapshot("b".repeat(40), files)

    expect(contentsMatch(existing.manifest, latest.manifest)).toBe(true)
  })

  test("rejects a missing required reference and unsafe relative reference", () => {
    expect(() =>
      buildSnapshot(revision, {
        ...files,
        "skills/outlit/references/identity.md": undefined,
      }),
    ).toThrow(/identity\.md/)
    expect(() =>
      buildSnapshot(revision, {
        ...files,
        "skills/outlit/SKILL.md": `${source}\nRead [escape](references/../private.md).\n`,
      }),
    ).toThrow(/unsafe reference/)
  })

  test("detects changed reference bytes even when the skill body stays the same", () => {
    const existing = buildSnapshot(revision, files)
    const latest = buildSnapshot("b".repeat(40), {
      ...files,
      "skills/outlit/references/identity.md": "# Updated identity\n",
    })

    expect(contentsMatch(existing.manifest, latest.manifest)).toBe(false)
  })

  test.each([
    "[local](./references/identity.md)",
    "[other](agents/openai.yaml)",
    "[sibling](../outlit-sdk/SKILL.md)",
    "[identity-ref]: references/identity.md",
  ])("rejects an unsupported relative Markdown target: %s", (link) => {
    expect(() =>
      buildSnapshot(revision, {
        ...files,
        "skills/outlit/SKILL.md": `${source}\n${link}\n`,
      }),
    ).toThrow(/unsupported relative link/)
  })

  test("requires the outlit name inside YAML frontmatter", () => {
    const wrongFrontmatter = source.replace("name: outlit", "name: other") + "\nname: outlit\n"

    expect(() =>
      buildSnapshot(revision, { ...files, "skills/outlit/SKILL.md": wrongFrontmatter }),
    ).toThrow(/frontmatter/)
  })

  test("rejects nested relative links inside fetched reference Markdown", () => {
    expect(() =>
      buildSnapshot(revision, {
        ...files,
        "skills/outlit/references/identity.md": "# Identity\n\n[more](../private.md)\n",
      }),
    ).toThrow(/unsupported relative link.*identity\.md/)
  })
})
