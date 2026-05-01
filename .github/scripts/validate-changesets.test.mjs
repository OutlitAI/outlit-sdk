import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"
import { validateReleasePlan } from "./validate-changesets.mjs"

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function createFixture(changesetBody) {
  const root = mkdtempSync(join(tmpdir(), "outlit-changesets-"))
  mkdirSync(join(root, ".changeset"), { recursive: true })
  mkdirSync(join(root, "packages", "tools"), { recursive: true })
  mkdirSync(join(root, "packages", "cli"), { recursive: true })
  mkdirSync(join(root, "packages", "pi"), { recursive: true })
  mkdirSync(join(root, "packages", "private-helper"), { recursive: true })

  writeFileSync(join(root, ".changeset", "release.md"), changesetBody)
  writeJson(join(root, "packages", "tools", "package.json"), {
    name: "@outlit/tools",
    version: "0.2.0",
  })
  writeJson(join(root, "packages", "cli", "package.json"), {
    name: "@outlit/cli",
    version: "1.7.0",
    dependencies: { "@outlit/tools": "^0.2.0" },
  })
  writeJson(join(root, "packages", "pi", "package.json"), {
    name: "@outlit/pi",
    version: "0.1.3",
    dependencies: { "@outlit/tools": "^0.2.0" },
  })
  writeJson(join(root, "packages", "private-helper", "package.json"), {
    name: "@outlit/private-helper",
    private: true,
    dependencies: { "@outlit/tools": "^0.2.0" },
  })

  return root
}

test("requires published runtime dependents when @outlit/tools is released", () => {
  const root = createFixture(`---
"@outlit/tools": patch
"@outlit/cli": patch
---

Tools changed.
`)

  const result = validateReleasePlan({ root, packageName: "@outlit/tools" })

  assert.equal(result.ok, false)
  assert.deepEqual(result.missingDependents, ["@outlit/pi"])
  assert.match(result.message, /@outlit\/pi/)
})

test("supports CRLF changeset frontmatter", () => {
  const root = createFixture(
    [
      "---",
      '"@outlit/tools": patch',
      '"@outlit/cli": patch',
      "---",
      "",
      "Tools changed.",
      "",
    ].join("\r\n"),
  )

  const result = validateReleasePlan({ root, packageName: "@outlit/tools" })

  assert.equal(result.ok, false)
  assert.deepEqual(result.missingDependents, ["@outlit/pi"])
})

test("supports indented unquoted changeset package keys", () => {
  const root = createFixture(`---
  @outlit/tools: patch
  @outlit/cli: patch
---

Tools changed.
`)

  const result = validateReleasePlan({ root, packageName: "@outlit/tools" })

  assert.equal(result.ok, false)
  assert.deepEqual(result.missingDependents, ["@outlit/pi"])
})

test("passes when @outlit/tools and its published runtime dependents are released", () => {
  const root = createFixture(`---
"@outlit/tools": patch
"@outlit/cli": patch
"@outlit/pi": patch
---

Tools changed.
`)

  const result = validateReleasePlan({ root, packageName: "@outlit/tools" })

  assert.equal(result.ok, true)
})

test("passes when @outlit/tools is not released", () => {
  const root = createFixture(`---
"@outlit/cli": patch
---

CLI changed.
`)

  const result = validateReleasePlan({ root, packageName: "@outlit/tools" })

  assert.equal(result.ok, true)
})
