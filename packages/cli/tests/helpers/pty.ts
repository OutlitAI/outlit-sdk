import path from "node:path"

export type SecretPromptScenario = "success" | "cancel" | "throw" | "SIGINT" | "SIGTERM"

export interface SecretPromptPtyResult {
  transcript: string
  echoEnabled: boolean
}

export async function runSecretPromptPtyScenario(
  cwd: string,
  scenario: SecretPromptScenario,
  syntheticSecret: string,
): Promise<SecretPromptPtyResult> {
  const runner = path.join(import.meta.dir, "pty-runner.cjs")
  const child = Bun.spawn(["node", runner, scenario], {
    cwd,
    env: { ...process.env, PTY_TEST_SECRET: syntheticSecret },
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`PTY runner failed (${exitCode}): ${stderr || stdout}`)
  }

  return JSON.parse(stdout) as SecretPromptPtyResult
}
