import { accessSync, constants } from "node:fs"
import path from "node:path"

const NODE_IDENTITY_SCRIPT =
  "process.stdout.write(process.release.name + ':' + process.versions.node)"
const NODE_IDENTITY_PATTERN = /^node:\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

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
  const child = Bun.spawn([resolveNodeBinary(), runner, scenario], {
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

function resolveNodeBinary(): string {
  const configuredBinary = process.env.OUTLIT_NODE_BINARY?.trim()
  if (!configuredBinary) return "node"
  if (!path.isAbsolute(configuredBinary)) {
    throw new Error("OUTLIT_NODE_BINARY must be an absolute executable path")
  }

  try {
    accessSync(configuredBinary, constants.X_OK)
  } catch {
    throw new Error("OUTLIT_NODE_BINARY must be an absolute executable path")
  }

  if (!isNodeExecutable(configuredBinary)) {
    throw new Error("OUTLIT_NODE_BINARY must point to a Node.js executable")
  }

  return configuredBinary
}

function isNodeExecutable(binary: string): boolean {
  try {
    const result = Bun.spawnSync([binary, "--eval", NODE_IDENTITY_SCRIPT], {
      stdout: "pipe",
      stderr: "ignore",
    })
    if (result.exitCode !== 0) return false

    return NODE_IDENTITY_PATTERN.test(new TextDecoder().decode(result.stdout).trim())
  } catch {
    return false
  }
}
