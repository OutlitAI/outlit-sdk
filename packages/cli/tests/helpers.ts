import { afterEach, beforeEach, expect, spyOn } from "bun:test"
import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/** Runtime-generated test API key to avoid Gitleaks false positives on static ok_ strings. */
export const TEST_API_KEY = `ok_${"a".repeat(32)}`

export class ExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`)
    this.name = "ExitError"
  }
}

export function mockExitThrow(): ReturnType<typeof spyOn> {
  const impl = (code?: number): never => {
    throw new ExitError(code ?? 0)
  }
  return spyOn(process, "exit").mockImplementation(impl)
}

export function setNonInteractive(): void {
  Object.defineProperty(process.stdin, "isTTY", {
    value: undefined,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(process.stdout, "isTTY", {
    value: undefined,
    writable: true,
    configurable: true,
  })
}

export function setInteractive(): void {
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    writable: true,
    configurable: true,
  })
}

/**
 * Creates a temp directory and sets XDG_CONFIG_HOME + OUTLIT_API_KEY for the test suite.
 * Registers beforeEach/afterEach hooks automatically.
 * Returns the temp dir path for use in tests.
 */
export function useTempEnv(label: string): string {
  const testDir = join(tmpdir(), `outlit-cli-${label}-${Date.now()}`)

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
    process.env.XDG_CONFIG_HOME = testDir
    process.env.OUTLIT_API_KEY = TEST_API_KEY
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
    Reflect.deleteProperty(process.env, "XDG_CONFIG_HOME")
    Reflect.deleteProperty(process.env, "OUTLIT_API_KEY")
  })

  return testDir
}

/**
 * Asserts that an error exit occurred with the expected error code in stderr JSON.
 * Used for auth_required, not_authenticated, write_error, api_error assertions.
 */
export function expectErrorExit(thrown: unknown, stderrOutput: string, expectedCode: string): void {
  expect(thrown).toBeInstanceOf(ExitError)
  expect((thrown as ExitError).code).toBe(1)
  const parsed = JSON.parse(stderrOutput) as Record<string, unknown>
  expect(parsed.code).toBe(expectedCode)
}
