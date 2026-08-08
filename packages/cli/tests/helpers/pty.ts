import { accessSync, constants, realpathSync } from "node:fs"
import path from "node:path"

const NODE_VERSION_DIRECTORY_PATTERN = /^\d+\.\d+\.\d+$/
const INVALID_TOOL_CACHE_NODE_ERROR =
  "OUTLIT_NODE_BINARY must point to the GitHub Actions Node tool-cache executable"

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
  if (process.env.GITHUB_ACTIONS !== "true") {
    throw new Error("OUTLIT_NODE_BINARY is only supported in GitHub Actions")
  }
  if (!path.isAbsolute(configuredBinary)) {
    throw new Error("OUTLIT_NODE_BINARY must be an absolute executable path")
  }

  const runnerToolCache = process.env.RUNNER_TOOL_CACHE?.trim()
  if (!runnerToolCache || !path.isAbsolute(runnerToolCache)) {
    throw new Error(INVALID_TOOL_CACHE_NODE_ERROR)
  }

  try {
    const nodeToolCache = realpathSync(path.join(runnerToolCache, "node"))
    const resolvedBinary = realpathSync(configuredBinary)
    const relativeBinary = path.relative(nodeToolCache, resolvedBinary)
    const [version, architecture, binDirectory, executable, ...extraSegments] =
      relativeBinary.split(path.sep)

    if (
      !version ||
      !NODE_VERSION_DIRECTORY_PATTERN.test(version) ||
      !architecture ||
      binDirectory !== "bin" ||
      executable !== "node" ||
      extraSegments.length > 0 ||
      path.isAbsolute(relativeBinary)
    ) {
      throw new Error(INVALID_TOOL_CACHE_NODE_ERROR)
    }

    accessSync(resolvedBinary, constants.X_OK)

    return resolvedBinary
  } catch {
    throw new Error(INVALID_TOOL_CACHE_NODE_ERROR)
  }
}
