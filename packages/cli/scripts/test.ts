/**
 * Runs the CLI tests in separate bun processes.
 *
 * bun's mock.module() replaces a module for every test file in the same process, so suites
 * that need the real module can't share a run with suites that mock it. Each group below gets
 * its own process. CI and local `bun run test` both use this, so they see the same results.
 *
 * Arguments are passed straight to a single `bun test` run, e.g. `bun run test tests/lib`.
 */
/** Each group runs in its own process; files not listed run together in the last one. */
const isolatedGroups = [
  // config and client tests use the real (unmocked) modules.
  ["tests/lib/config.test.ts", "tests/lib/client.test.ts"],
  // stubs pollUntil, while the integration setup suite mocks this whole module.
  ["tests/commands/integrations/wait-for-connection.test.ts"],
]

function bunTest(args: string[]): boolean {
  const result = Bun.spawnSync(["bun", "test", ...args], {
    stdio: ["inherit", "inherit", "inherit"],
  })
  return result.exitCode === 0
}

const passthrough = process.argv.slice(2)
if (passthrough.length > 0) {
  process.exit(bunTest(passthrough) ? 0 : 1)
}

const isolated = new Set(isolatedGroups.flat())
const shared = [...new Bun.Glob("tests/**/*.test.ts").scanSync(".")]
  .filter((file) => !isolated.has(file))
  .sort()

let ok = true
for (const group of [...isolatedGroups, shared]) {
  if (!bunTest(group)) ok = false
}
process.exit(ok ? 0 : 1)
