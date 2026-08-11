import { describe, expect, test } from "bun:test"
import path from "node:path"
import { runSecretPromptPtyScenario, type SecretPromptScenario } from "../helpers/pty"

const cliRoot = path.resolve(import.meta.dir, "../..")
const syntheticSecret = "synthetic-pty-secret-never-echo"

describe("secret prompt PTY behavior", () => {
  test.each([
    ["success", true],
    ["cancel", false],
    ["throw", true],
    ["SIGINT", false],
    ["SIGTERM", false],
  ] as const)(
    "restores terminal echo after %s",
    async (scenario, entersSecret) => {
      const result = await runSecretPromptPtyScenario(
        cliRoot,
        scenario as SecretPromptScenario,
        syntheticSecret,
      )

      expect(result.echoEnabled).toBe(true)
      if (entersSecret) expect(result.transcript).not.toContain(syntheticSecret)
    },
    15_000,
  )
})
