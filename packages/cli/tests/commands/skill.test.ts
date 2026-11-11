import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { OUTLIT_SKILL, OUTLIT_SKILL_STUB } from "../../src/lib/skill"

const cliEntry = join(import.meta.dir, "../../src/cli.ts")
const skillDoc = join(import.meta.dir, "../../../../docs/skill.md")

// No credentials, no config, no network.
function runCli(args: string[]) {
  const home = mkdtempSync(join(tmpdir(), "outlit-skill-test-"))
  return Bun.spawnSync(["bun", "run", cliEntry, ...args], {
    env: { PATH: process.env.PATH ?? "", HOME: home, XDG_CONFIG_HOME: home, CI: "1" },
    stdout: "pipe",
    stderr: "pipe",
  })
}

describe("outlit --skill", () => {
  test("embedded text equals docs/skill.md byte for byte", () => {
    expect(OUTLIT_SKILL).toBe(readFileSync(skillDoc, "utf8"))
  })

  test("prints the skill and exits 0 with no credentials", () => {
    const result = runCli(["--skill"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toBe(readFileSync(skillDoc, "utf8"))
  })

  test("accepts the skill name and rejects unknown names", () => {
    expect(runCli(["--skill", "outlit"]).exitCode).toBe(0)
    const unknown = runCli(["--skill", "nope"])
    expect(unknown.exitCode).toBe(1)
    expect(unknown.stderr.toString()).toContain('Unknown skill "nope"')
  })

  test("installed stub points at outlit --skill", () => {
    expect(OUTLIT_SKILL_STUB).toContain("outlit --skill")
    expect(OUTLIT_SKILL_STUB.startsWith("---\nname: outlit\n")).toBe(true)
  })
})
