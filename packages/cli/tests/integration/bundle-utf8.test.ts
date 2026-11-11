import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// The npm bundle runs under Bun (its shebang). A `// @bun` pragma makes Bun read it as Latin-1,
// which garbles every non-ASCII literal. Build with the package's own script and compare bytes.

const packageDir = join(import.meta.dir, "..", "..")
const bundle = join(packageDir, "dist", "cli.js")
const skillFile = join(packageDir, "..", "..", "docs", "skill.md")
let home: string

beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), "outlit-bundle-utf8-"))
  const build = Bun.spawn(["bun", "run", "build"], {
    cwd: packageDir,
    stdout: "ignore",
    stderr: "pipe",
  })
  if ((await build.exited) !== 0) throw new Error(await new Response(build.stderr).text())
}, 60_000)

afterAll(() => {
  rmSync(home, { recursive: true, force: true })
})

test("the built bundle prints docs/skill.md byte for byte under bun", async () => {
  const { OUTLIT_API_KEY: _key, ...env } = process.env
  const proc = Bun.spawn(["bun", bundle, "--skill"], {
    cwd: home,
    env: { ...env, HOME: home, XDG_CONFIG_HOME: join(home, ".config") },
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = Buffer.from(await new Response(proc.stdout).arrayBuffer())
  expect(await proc.exited).toBe(0)
  expect(stdout.equals(readFileSync(skillFile))).toBe(true)
})
