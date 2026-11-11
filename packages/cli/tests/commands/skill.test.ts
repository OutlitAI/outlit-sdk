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

  test("--skill after -- or a subcommand is data, not the flag", () => {
    const result = runCli(["search", "--", "--skill"])
    expect(result.stdout.toString()).not.toContain("# Outlit")
  })

  const hasPython = Bun.spawnSync(["python3", "--version"]).exitCode === 0

  // process.exit() after a write can cut off output Node has not flushed to a pipe.
  // A 4 KB pipe read late (F_SETPIPE_SZ, Linux) reproduces it: the old code delivered 4096 bytes.
  test.skipIf(!hasPython || process.platform !== "linux")(
    "built Node bundle delivers every byte through a small backed-up pipe",
    () => {
      const out = mkdtempSync(join(tmpdir(), "outlit-skill-build-"))
      const build = Bun.spawnSync(["bun", "build", cliEntry, "--outdir", out, "--target", "node"])
      expect(build.exitCode).toBe(0)

      const harness = [
        "import os, sys, fcntl, subprocess, time",
        "r, w = os.pipe()",
        "fcntl.fcntl(w, 1031, 4096)",
        'p = subprocess.Popen(["node", sys.argv[1], "--skill"], stdout=w, env={"PATH": os.environ["PATH"], "HOME": sys.argv[2], "CI": "1"})',
        "os.close(w)",
        "time.sleep(0.5)",
        "n = 0",
        "while True:",
        "    b = os.read(r, 1024)",
        "    if not b: break",
        "    n += len(b)",
        "print(p.wait(), n)",
      ].join("\n")
      const result = Bun.spawnSync(["python3", "-c", harness, join(out, "cli.js"), out])
      const [code, bytes] = result.stdout.toString().trim().split(" ").map(Number)
      expect(code).toBe(0)
      expect(bytes).toBe(Buffer.byteLength(readFileSync(skillDoc, "utf8")))
    },
  )

  test("installed stub points at outlit --skill", () => {
    expect(OUTLIT_SKILL_STUB).toContain("outlit --skill")
    expect(OUTLIT_SKILL_STUB.startsWith("---\nname: outlit\n")).toBe(true)
  })
})
