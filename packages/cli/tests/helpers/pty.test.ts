import { afterEach, describe, expect, spyOn, test } from "bun:test"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { runSecretPromptPtyScenario } from "./pty"

const originalEnvironment = {
  GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
  OUTLIT_NODE_BINARY: process.env.OUTLIT_NODE_BINARY,
  RUNNER_TOOL_CACHE: process.env.RUNNER_TOOL_CACHE,
}
const temporaryDirectories: string[] = []

afterEach(() => {
  restoreEnvironment("GITHUB_ACTIONS", originalEnvironment.GITHUB_ACTIONS)
  restoreEnvironment("OUTLIT_NODE_BINARY", originalEnvironment.OUTLIT_NODE_BINARY)
  restoreEnvironment("RUNNER_TOOL_CACHE", originalEnvironment.RUNNER_TOOL_CACHE)

  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("PTY Node subprocess", () => {
  test("uses the protected GitHub Actions tool-cache Node without probing it", async () => {
    const { nodeBinary, toolCache } = createToolCacheNode()
    process.env.GITHUB_ACTIONS = "true"
    process.env.RUNNER_TOOL_CACHE = toolCache
    process.env.OUTLIT_NODE_BINARY = nodeBinary

    let command: readonly string[] | undefined
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation(((args: readonly string[]) => {
      command = args
      throw new Error("stop before subprocess")
    }) as unknown as typeof Bun.spawn)
    const spawnSyncSpy = spyOn(Bun, "spawnSync").mockImplementation(() => {
      throw new Error("candidate must not be probed")
    })

    try {
      await expect(
        runSecretPromptPtyScenario(import.meta.dir, "success", "synthetic-secret"),
      ).rejects.toThrow("stop before subprocess")
      expect(command?.[0]).toBe(realpathSync(nodeBinary))
      expect(spawnSyncSpy).not.toHaveBeenCalled()
    } finally {
      spawnSpy.mockRestore()
      spawnSyncSpy.mockRestore()
    }
  })

  test("uses bare Node locally when no override is configured", async () => {
    Reflect.deleteProperty(process.env, "GITHUB_ACTIONS")
    Reflect.deleteProperty(process.env, "RUNNER_TOOL_CACHE")
    Reflect.deleteProperty(process.env, "OUTLIT_NODE_BINARY")

    let command: readonly string[] | undefined
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation(((args: readonly string[]) => {
      command = args
      throw new Error("stop before subprocess")
    }) as unknown as typeof Bun.spawn)
    const spawnSyncSpy = spyOn(Bun, "spawnSync").mockImplementation(() => {
      throw new Error("candidate must not be probed")
    })

    try {
      await expect(
        runSecretPromptPtyScenario(import.meta.dir, "success", "synthetic-secret"),
      ).rejects.toThrow("stop before subprocess")
      expect(command?.[0]).toBe("node")
      expect(spawnSyncSpy).not.toHaveBeenCalled()
    } finally {
      spawnSpy.mockRestore()
      spawnSyncSpy.mockRestore()
    }
  })

  test("rejects a Node override outside GitHub Actions without spawning it", async () => {
    Reflect.deleteProperty(process.env, "GITHUB_ACTIONS")
    process.env.OUTLIT_NODE_BINARY = "/bin/sh"

    const { spawnSpy, spawnSyncSpy } = rejectSubprocesses()
    try {
      await expect(
        runSecretPromptPtyScenario(import.meta.dir, "success", "synthetic-secret"),
      ).rejects.toThrow("OUTLIT_NODE_BINARY is only supported in GitHub Actions")
      expect(spawnSpy).not.toHaveBeenCalled()
      expect(spawnSyncSpy).not.toHaveBeenCalled()
    } finally {
      spawnSpy.mockRestore()
      spawnSyncSpy.mockRestore()
    }
  })

  test("rejects a path outside the runner Node tool cache without spawning it", async () => {
    const { toolCache } = createToolCacheNode()
    process.env.GITHUB_ACTIONS = "true"
    process.env.RUNNER_TOOL_CACHE = toolCache
    process.env.OUTLIT_NODE_BINARY = "/bin/sh"

    const { spawnSpy, spawnSyncSpy } = rejectSubprocesses()
    try {
      await expect(
        runSecretPromptPtyScenario(import.meta.dir, "success", "synthetic-secret"),
      ).rejects.toThrow(
        "OUTLIT_NODE_BINARY must point to the GitHub Actions Node tool-cache executable",
      )
      expect(spawnSpy).not.toHaveBeenCalled()
      expect(spawnSyncSpy).not.toHaveBeenCalled()
    } finally {
      spawnSpy.mockRestore()
      spawnSyncSpy.mockRestore()
    }
  })

  test("rejects a tool-cache path that resolves outside the cache without spawning it", async () => {
    const { nodeBinary, toolCache } = createToolCacheNode({ symlinkTarget: "/bin/sh" })
    process.env.GITHUB_ACTIONS = "true"
    process.env.RUNNER_TOOL_CACHE = toolCache
    process.env.OUTLIT_NODE_BINARY = nodeBinary

    const { spawnSpy, spawnSyncSpy } = rejectSubprocesses()
    try {
      await expect(
        runSecretPromptPtyScenario(import.meta.dir, "success", "synthetic-secret"),
      ).rejects.toThrow(
        "OUTLIT_NODE_BINARY must point to the GitHub Actions Node tool-cache executable",
      )
      expect(spawnSpy).not.toHaveBeenCalled()
      expect(spawnSyncSpy).not.toHaveBeenCalled()
    } finally {
      spawnSpy.mockRestore()
      spawnSyncSpy.mockRestore()
    }
  })

  test("rejects a non-absolute workflow binary before spawning", async () => {
    const { toolCache } = createToolCacheNode()
    process.env.GITHUB_ACTIONS = "true"
    process.env.RUNNER_TOOL_CACHE = toolCache
    process.env.OUTLIT_NODE_BINARY = "node"

    const { spawnSpy, spawnSyncSpy } = rejectSubprocesses()
    try {
      await expect(
        runSecretPromptPtyScenario(import.meta.dir, "success", "synthetic-secret"),
      ).rejects.toThrow("OUTLIT_NODE_BINARY must be an absolute executable path")
      expect(spawnSpy).not.toHaveBeenCalled()
      expect(spawnSyncSpy).not.toHaveBeenCalled()
    } finally {
      spawnSpy.mockRestore()
      spawnSyncSpy.mockRestore()
    }
  })
})

function createToolCacheNode(options?: { symlinkTarget?: string }): {
  nodeBinary: string
  toolCache: string
} {
  const directory = mkdtempSync(path.join(tmpdir(), "outlit-pty-node-"))
  temporaryDirectories.push(directory)

  const toolCache = path.join(directory, "tool-cache")
  const nodeBinary = path.join(toolCache, "node", "22.0.0", "x64", "bin", "node")
  mkdirSync(path.dirname(nodeBinary), { recursive: true })
  if (options?.symlinkTarget) {
    symlinkSync(options.symlinkTarget, nodeBinary)
  } else {
    writeFileSync(nodeBinary, "")
    chmodSync(nodeBinary, 0o755)
  }

  return { nodeBinary, toolCache }
}

function rejectSubprocesses(): {
  spawnSpy: ReturnType<typeof spyOn<typeof Bun, "spawn">>
  spawnSyncSpy: ReturnType<typeof spyOn<typeof Bun, "spawnSync">>
} {
  const spawnSpy = spyOn(Bun, "spawn").mockImplementation(() => {
    throw new Error("spawn should not be called")
  })
  const spawnSyncSpy = spyOn(Bun, "spawnSync").mockImplementation(() => {
    throw new Error("spawnSync should not be called")
  })
  return { spawnSpy, spawnSyncSpy }
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name)
    return
  }

  process.env[name] = value
}
