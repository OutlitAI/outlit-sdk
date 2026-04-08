import { execFileSync, spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
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

interface InstallerDetectionOptions {
  argv1?: string
  realExecPath?: string | null
  npmGlobalPrefix?: string | null
  bunGlobalBin?: string | null
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

function inferInstallerFromUserAgent(agent: string): Installer | null {
  if (agent.startsWith("bun/")) return "bun"
  if (agent.startsWith("npm/")) return "npm"
  if (agent.startsWith("pnpm/")) return "pnpm"
  if (agent.startsWith("yarn/")) return "yarn"
  return null
}

function isUnderPath(path: string, parent: string): boolean {
  return path === parent || path.startsWith(`${parent}/`)
}

export function inferInstallerFromInstallation(opts: InstallerDetectionOptions): Installer | null {
  const candidatePaths = [opts.argv1, opts.realExecPath].filter((value): value is string => !!value)

  if (opts.npmGlobalPrefix) {
    const npmPackageRoots = [
      join(opts.npmGlobalPrefix, "node_modules", PACKAGE_NAME),
      join(opts.npmGlobalPrefix, "lib", "node_modules", PACKAGE_NAME),
    ]

    if (candidatePaths.some((path) => npmPackageRoots.some((root) => isUnderPath(path, root)))) {
      return "npm"
    }
  }

  if (opts.bunGlobalBin) {
    const bunGlobalBin = opts.bunGlobalBin
    if (candidatePaths.some((path) => isUnderPath(path, bunGlobalBin))) {
      return "bun"
    }
  }

  return null
}

function readCommandOutput(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

export function inferInstaller(): Installer | null {
  const fromAgent = inferInstallerFromUserAgent(process.env.npm_config_user_agent ?? "")
  if (fromAgent) return fromAgent

  const argv1 = process.argv[1]
  const realExecPath = argv1
    ? (readCommandOutput("realpath", [argv1]) ?? safeRealPath(argv1))
    : null
  const npmGlobalPrefix =
    process.env.npm_config_prefix ?? readCommandOutput("npm", ["prefix", "-g"])
  const bunGlobalBin = process.env.BUN_INSTALL
    ? join(process.env.BUN_INSTALL, "bin")
    : (readCommandOutput("bun", ["pm", "bin", "-g"]) ?? join(homedir(), ".bun", "bin"))

  return inferInstallerFromInstallation({
    argv1,
    realExecPath,
    npmGlobalPrefix,
    bunGlobalBin,
  })
}

function safeRealPath(filePath: string): string | null {
  try {
    return realpathSync(filePath)
  } catch {
    return null
  }
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
