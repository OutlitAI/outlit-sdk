import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJsonPath = join(packageRoot, "package.json")

describe("@outlit/pi package metadata", () => {
  test("loads and publishes Pi skills", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      files?: string[]
      pi?: {
        skills?: string[]
      }
    }

    expect(packageJson.pi?.skills).toContain("./skills")
    expect(packageJson.files).toContain("skills")
    expect(existsSync(join(packageRoot, "skills", "outlit", "SKILL.md"))).toBe(true)
    expect(
      existsSync(join(packageRoot, "skills", "outlit", "references", "sql-reference.md")),
    ).toBe(true)
  })
})
