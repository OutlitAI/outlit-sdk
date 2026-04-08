import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { CLI_VERSION, getConfigDir } from "./config"
import { isInteractive } from "./tty"

export { CLI_VERSION }

const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000
const PACKAGE_NAME = "@outlit/cli"
const LATEST_VERSION_URL = "https://registry.npmjs.org/@outlit%2Fcli/latest"
export const INTERNAL_UPDATE_FLAG = "--internal-update-check"

export type Installer = "bun" | "npm" | "pnpm" | "yarn"

export interface UpgradeCommand {
  command: string
  args: string[]
  displayCommand: string
}

export interface UpdateCacheState {
  lastCheckedAt: number
  latestVersion?: string
  installer?: Installer
}

export interface UpdateNotice {
  currentVersion: string
  latestVersion: string
  command: string
}

export function getUpdateCachePath(): string {
  return join(getConfigDir(), "update-check.json")
}

export function clearCachedUpdateState(): void {
  rmSync(getUpdateCachePath(), { force: true })
}

export function readCachedUpdateState(): UpdateCacheState | null {
  const cachePath = getUpdateCachePath()
  if (!existsSync(cachePath)) return null

  try {
    return JSON.parse(readFileSync(cachePath, "utf8")) as UpdateCacheState
  } catch {
    return null
  }
}

export function writeCachedUpdateState(state: UpdateCacheState): void {
  const cachePath = getUpdateCachePath()
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, `${JSON.stringify(state, null, 2)}\n`)
}

export function isUpdateCheckDue(state: Pick<UpdateCacheState, "lastCheckedAt"> | null): boolean {
  if (!state?.lastCheckedAt) return true
  return Date.now() - state.lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS
}

export function compareVersions(a: string, b: string): number {
  const aParts =
    a
      .split("-")[0]
      ?.split(".")
      .map((part) => Number.parseInt(part, 10) || 0) ?? []
  const bParts =
    b
      .split("-")[0]
      ?.split(".")
      .map((part) => Number.parseInt(part, 10) || 0) ?? []
  const maxLength = Math.max(aParts.length, bParts.length)

  for (let index = 0; index < maxLength; index++) {
    const left = aParts[index] ?? 0
    const right = bParts[index] ?? 0
    if (left > right) return 1
    if (left < right) return -1
  }

  return 0
}

export function inferInstaller(): Installer | null {
  const agent = process.env.npm_config_user_agent ?? ""
  if (agent.startsWith("bun/")) return "bun"
  if (agent.startsWith("npm/")) return "npm"
  if (agent.startsWith("pnpm/")) return "pnpm"
  if (agent.startsWith("yarn/")) return "yarn"
  return null
}

export function formatUpdateCommand(installer = inferInstaller()): string {
  switch (installer) {
    case "bun":
      return "bun add -g @outlit/cli"
    case "npm":
      return "npm install -g @outlit/cli"
    case "pnpm":
      return "pnpm add -g @outlit/cli"
    case "yarn":
      return "yarn global add @outlit/cli"
    default:
      return `update ${PACKAGE_NAME} with your package manager`
  }
}

export function getUpgradeCommand(installer = inferInstaller()): UpgradeCommand | null {
  switch (installer) {
    case "bun":
      return {
        command: "bun",
        args: ["add", "-g", "@outlit/cli"],
        displayCommand: "bun add -g @outlit/cli",
      }
    case "npm":
      return {
        command: "npm",
        args: ["install", "-g", "@outlit/cli"],
        displayCommand: "npm install -g @outlit/cli",
      }
    case "pnpm":
      return {
        command: "pnpm",
        args: ["add", "-g", "@outlit/cli"],
        displayCommand: "pnpm add -g @outlit/cli",
      }
    case "yarn":
      return {
        command: "yarn",
        args: ["global", "add", "@outlit/cli"],
        displayCommand: "yarn global add @outlit/cli",
      }
    default:
      return null
  }
}

export function getCachedUpdateNotice(state = readCachedUpdateState()): UpdateNotice | null {
  if (!state?.latestVersion) return null
  if (compareVersions(CLI_VERSION, state.latestVersion) >= 0) return null

  return {
    currentVersion: CLI_VERSION,
    latestVersion: state.latestVersion,
    command: formatUpdateCommand(state.installer),
  }
}

export function shouldCheckForUpdates(): boolean {
  if (process.env.OUTLIT_NO_UPDATE_NOTIFIER) return false
  return isInteractive()
}

export function shouldShowUpdateNotice(argv = process.argv): boolean {
  return shouldCheckForUpdates() && !argv.includes("--json") && !argv.includes(INTERNAL_UPDATE_FLAG)
}

export function printCachedUpdateNotice(
  argv = process.argv,
  notify: (message: string) => void = console.error,
): boolean {
  if (!shouldShowUpdateNotice(argv)) return false

  const notice = getCachedUpdateNotice()
  if (!notice) return false

  notify(
    `Outlit CLI update available: ${notice.currentVersion} -> ${notice.latestVersion}\nUpdate with: ${notice.command}`,
  )
  return true
}

type SpawnProcess = { unref?: () => void }

type SpawnFn = (
  command: string,
  args: string[],
  options: { detached: boolean; stdio: "ignore" },
) => SpawnProcess

export function scheduleBackgroundUpdateCheck(
  argv = process.argv,
  spawnProcess: SpawnFn = spawn,
): boolean {
  if (!shouldShowUpdateNotice(argv)) return false
  if (!isUpdateCheckDue(readCachedUpdateState())) return false

  const runtimePath = argv[0]
  const scriptPath = argv[1]
  if (!runtimePath || !scriptPath) return false

  const child = spawnProcess(runtimePath, [scriptPath, INTERNAL_UPDATE_FLAG], {
    detached: true,
    stdio: "ignore",
  })
  child.unref?.()
  return true
}

export function initializeUpdateNotifier(opts?: {
  argv?: string[]
  spawn?: SpawnFn
  notify?: (message: string) => void
}): void {
  const argv = opts?.argv ?? process.argv
  printCachedUpdateNotice(argv, opts?.notify)
  scheduleBackgroundUpdateCheck(argv, opts?.spawn)
}

export async function fetchLatestCliVersion(): Promise<string> {
  const response = await fetch(LATEST_VERSION_URL, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error("registry unavailable")
  const data = (await response.json()) as { version?: string }
  if (!data.version) throw new Error("registry returned no version")
  return data.version
}

export async function runInternalUpdateCheck(opts?: {
  fetchLatestVersion?: () => Promise<string>
  installer?: Installer | null
}): Promise<void> {
  const fetchLatestVersion = opts?.fetchLatestVersion ?? fetchLatestCliVersion
  const installer = opts?.installer ?? inferInstaller()

  try {
    const latestVersion = await fetchLatestVersion()
    writeCachedUpdateState({
      lastCheckedAt: Date.now(),
      latestVersion,
      ...(installer ? { installer } : {}),
    })
  } catch {
    writeCachedUpdateState({
      lastCheckedAt: Date.now(),
      ...(installer ? { installer } : {}),
    })
  }
}

export function runUpgradeCommand(command: UpgradeCommand): void {
  const result = spawnSync(command.command, command.args, { stdio: "inherit" })

  if (result.error) throw result.error
  if (result.status !== 0 || result.signal) {
    throw new Error(`Upgrade command failed: ${command.displayCommand}`)
  }
}
