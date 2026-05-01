import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function readChangesetPackages(root) {
  const changesetDir = join(root, ".changeset")
  const files = readdirSync(changesetDir).filter(
    (file) => file.endsWith(".md") && file !== "README.md",
  )

  const packages = new Set()
  for (const file of files) {
    const contents = readFileSync(join(changesetDir, file), "utf8")
    const frontmatter = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!frontmatter) continue

    const lines = frontmatter[1].split(/\r?\n/)
    for (const line of lines) {
      const match = line.match(
        /^\s*(?:"([^"]+)"|'([^']+)'|([^:]+))\s*:\s*(major|minor|patch)\s*$/,
      )
      const packageName = match?.[1] ?? match?.[2] ?? match?.[3]?.trim()
      if (packageName) packages.add(packageName)
    }
  }

  return packages
}

function readPublishedRuntimeDependents(root, packageName) {
  const packagesDir = join(root, "packages")
  const entries = readdirSync(packagesDir, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  )

  return entries
    .flatMap((entry) => {
      const packageJson = readJson(join(packagesDir, entry.name, "package.json"))
      if (packageJson.private === true) return []
      if (!packageJson.dependencies?.[packageName]) return []

      return [packageJson.name]
    })
    .sort()
}

export function validateReleasePlan({
  root = process.cwd(),
  packageName = "@outlit/tools",
} = {}) {
  const releasedPackages = readChangesetPackages(root)
  if (!releasedPackages.has(packageName)) {
    return {
      ok: true,
      releasedPackages: [...releasedPackages].sort(),
      missingDependents: [],
      message: `${packageName} is not being released.`,
    }
  }

  const dependents = readPublishedRuntimeDependents(root, packageName)
  const missingDependents = dependents.filter((dependent) => !releasedPackages.has(dependent))

  if (missingDependents.length === 0) {
    return {
      ok: true,
      releasedPackages: [...releasedPackages].sort(),
      missingDependents,
      message: `${packageName} release includes all published runtime dependents.`,
    }
  }

  return {
    ok: false,
    releasedPackages: [...releasedPackages].sort(),
    missingDependents,
    message: [
      `${packageName} is being released, but these published runtime dependents are missing from the changeset release plan: ${missingDependents.join(", ")}.`,
      `Add ${missingDependents.map((name) => `"${name}": patch`).join(", ")} to a changeset so canary and stable releases publish compatible wrapper packages.`,
    ].join(" "),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateReleasePlan()

  if (!result.ok) {
    console.error(result.message)
    process.exit(1)
  }

  console.log(result.message)
}
