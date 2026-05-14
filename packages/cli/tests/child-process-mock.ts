import { mock } from "bun:test"

export const mockExecFileSync = mock((_cmd: string, _args: string[], _opts?: unknown) => undefined)
export const mockSpawn = mock(() => ({ unref: mock(() => {}) }))
export const mockSpawnSync = mock(() => ({ status: 0 }))

export function installChildProcessMock(): void {
  mock.module("node:child_process", () => ({
    execFileSync: mockExecFileSync,
    spawn: mockSpawn,
    spawnSync: mockSpawnSync,
  }))
}

export function resetChildProcessMocks(): void {
  mockExecFileSync.mockClear()
  mockExecFileSync.mockImplementation((_cmd: string, _args: string[], _opts?: unknown) => undefined)
  mockSpawn.mockClear()
  mockSpawn.mockImplementation(() => ({ unref: mock(() => {}) }))
  mockSpawnSync.mockClear()
  mockSpawnSync.mockImplementation(() => ({ status: 0 }))
}
