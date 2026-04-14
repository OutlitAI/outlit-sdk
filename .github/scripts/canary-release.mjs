import { appendFileSync, readFileSync } from "node:fs"
import { join } from "node:path"

const PUBLISHED_PACKAGES = [
  { name: "@outlit/browser", packageJson: "packages/browser/package.json" },
  { name: "@outlit/cli", packageJson: "packages/cli/package.json" },
  { name: "@outlit/core", packageJson: "packages/core/package.json" },
  { name: "@outlit/node", packageJson: "packages/node/package.json" },
  { name: "@outlit/tools", packageJson: "packages/tools/package.json" },
  { name: "@outlit/pi", packageJson: "packages/pi/package.json" },
]

export function getCanaryReleaseMetadata(packageVersions) {
  const snapshotPackages = PUBLISHED_PACKAGES.flatMap((pkg) => {
    const version = packageVersions[pkg.name]
    if (!version?.includes("-canary-")) return []

    return [{ name: pkg.name, version, installCommand: `npm install ${pkg.name}@canary` }]
  })

  return {
    hasSnapshots: snapshotPackages.length > 0,
    hasBrowserSnapshot: snapshotPackages.some((pkg) => pkg.name === "@outlit/browser"),
    snapshotPackages,
  }
}

function readPackageVersions() {
  return Object.fromEntries(
    PUBLISHED_PACKAGES.map((pkg) => {
      const filePath = join(process.cwd(), pkg.packageJson)
      const { version } = JSON.parse(readFileSync(filePath, "utf8"))
      return [pkg.name, version]
    }),
  )
}

function writeGitHubOutput(name, value) {
  const githubOutput = process.env.GITHUB_OUTPUT
  if (!githubOutput) return

  appendFileSync(githubOutput, `${name}=${value}\n`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const metadata = getCanaryReleaseMetadata(readPackageVersions())

  if (!metadata.hasSnapshots) {
    console.error("Refusing to publish canary: no package version contains a canary snapshot suffix")
    process.exit(1)
  }

  writeGitHubOutput("has_browser_snapshot", String(metadata.hasBrowserSnapshot))
  writeGitHubOutput(
    "snapshot_packages",
    metadata.snapshotPackages.map((pkg) => pkg.name).join(","),
  )

  console.log(
    `Canary snapshot packages: ${metadata.snapshotPackages.map((pkg) => `${pkg.name}@${pkg.version}`).join(", ")}`,
  )
}
