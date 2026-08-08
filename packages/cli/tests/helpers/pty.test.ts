import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { runSecretPromptPtyScenario } from "./pty"

const originalNodeBinary = process.env.OUTLIT_NODE_BINARY

afterEach(() => {
  if (originalNodeBinary === undefined) {
    Reflect.deleteProperty(process.env, "OUTLIT_NODE_BINARY")
  } else {
    process.env.OUTLIT_NODE_BINARY = originalNodeBinary
  }
})

describe("PTY Node subprocess", () => {
  test("prefers the absolute Node binary supplied by the workflow", async () => {
    process.env.OUTLIT_NODE_BINARY = "/bin/sh"
    let command: readonly string[] | undefined
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation(((args: readonly string[]) => {
      command = args
      throw new Error("stop before subprocess")
    }) as unknown as typeof Bun.spawn)

    try {
      await expect(
        runSecretPromptPtyScenario(import.meta.dir, "success", "synthetic-secret"),
      ).rejects.toThrow("stop before subprocess")
    } finally {
      spawnSpy.mockRestore()
    }

    expect(command?.[0]).toBe("/bin/sh")
  })

  test("rejects a non-absolute workflow binary before spawning", async () => {
    process.env.OUTLIT_NODE_BINARY = "node"
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation(() => {
      throw new Error("spawn should not be called")
    })

    try {
      await expect(
        runSecretPromptPtyScenario(import.meta.dir, "success", "synthetic-secret"),
      ).rejects.toThrow("OUTLIT_NODE_BINARY must be an absolute executable path")
      expect(spawnSpy).not.toHaveBeenCalled()
    } finally {
      spawnSpy.mockRestore()
    }
  })
})
