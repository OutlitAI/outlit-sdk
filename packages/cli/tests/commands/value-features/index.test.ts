import { describe, expect, test } from "bun:test"

async function runHelp(...args: string[]) {
  const proc = Bun.spawn(
    [process.execPath, `${import.meta.dir}/../../../src/cli.ts`, ...args, "--help"],
    {
      env: { ...process.env, OUTLIT_NO_UPDATE_NOTIFIER: "1" },
      stdout: "pipe",
      stderr: "pipe",
    },
  )

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { stdout, stderr, exitCode }
}

describe("Value Feature command routing", () => {
  test("registers the product-facing Value Feature lifecycle", async () => {
    const result = await runHelp("value-features")

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("USAGE outlit value-features workspace|create|archive")
    expect(result.stdout).toContain("Configure workspace Value Features")
    expect(result.stdout).not.toContain("workspace|create|archive|restore")
  })

  test("registers customer feature usage with customer reads", async () => {
    const result = await runHelp("customers")

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("feature-usage")
  })
})
