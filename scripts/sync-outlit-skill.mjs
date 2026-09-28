import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const repository = "https://github.com/OutlitAI/skills"
const sourceRoot = "skills/outlit"
const sourceSkill = `${sourceRoot}/SKILL.md`
const requiredReferences = ["references/identity.md", "references/sql-reference.md"]
const docsRoot = new URL("../docs/", import.meta.url)
const skillFile = new URL("skill.md", docsRoot)
const manifestFile = new URL("skill-source.json", docsRoot)

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function textFile(files, path) {
  const value = files[path]
  if (typeof value !== "string" && !Buffer.isBuffer(value)) {
    throw new Error(`Missing canonical file: ${path}`)
  }
  return typeof value === "string" ? value : new TextDecoder("utf-8", { fatal: true }).decode(value)
}

export function referencePaths(skill) {
  const paths = [...skill.matchAll(/\]\((references\/[^)]+)\)/g)].map((match) => match[1])
  for (const path of paths) {
    if (!/^references\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.md$/.test(path)) {
      throw new Error(`unsafe reference: ${path}`)
    }
  }
  for (const path of requiredReferences) {
    if (!paths.includes(path)) throw new Error(`Missing required reference link: ${path}`)
  }
  return [...new Set(paths)].sort()
}

function assertNoUnsupportedRelativeLinks(markdown, path) {
  const targets = [
    ...[...markdown.matchAll(/\]\(([^)]*)\)/g)].map((match) => match[1].trim()),
    ...[...markdown.matchAll(/^[ \t]{0,3}\[[^\]\r\n]+\]:[ \t]*(\S+)/gm)].map((match) => match[1]),
  ]
  for (const target of targets) {
    if (!/^(?:https?:\/\/|mailto:|#)/i.test(target)) {
      throw new Error(`unsupported relative link in ${path}: ${target}`)
    }
  }
}

export function buildSnapshot(revision, files) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error(`Invalid commit SHA: ${revision}`)
  const source = textFile(files, sourceSkill)
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
  if (!frontmatter || !/^name:[ \t]*outlit[ \t]*$/m.test(frontmatter)) {
    throw new Error("Canonical skill must have outlit YAML frontmatter")
  }

  const paths = referencePaths(source)
  const digests = { [sourceSkill]: sha256(source) }
  for (const path of paths) {
    const sourcePath = `${sourceRoot}/${path}`
    const reference = textFile(files, sourcePath)
    assertNoUnsupportedRelativeLinks(reference, sourcePath)
    digests[sourcePath] = sha256(reference)
  }

  const skill = source.replace(/\]\((references\/[^)]+)\)/g, (_original, path) => {
    return `](https://raw.githubusercontent.com/OutlitAI/skills/${revision}/${sourceRoot}/${path})`
  })
  assertNoUnsupportedRelativeLinks(skill, sourceSkill)
  return {
    skill,
    manifest: { repository, revision, files: digests },
  }
}

export function contentsMatch(a, b) {
  if (a?.repository !== b?.repository) return false
  const left = Object.entries(a.files ?? {}).sort(([aPath], [bPath]) => aPath.localeCompare(bPath))
  const right = Object.entries(b.files ?? {}).sort(([aPath], [bPath]) => aPath.localeCompare(bPath))
  return JSON.stringify(left) === JSON.stringify(right)
}

function latestRevision() {
  const result = spawnSync("git", ["ls-remote", `${repository}.git`, "refs/heads/main"], {
    encoding: "utf8",
  })
  if (result.status !== 0) throw new Error(`Could not resolve upstream main: ${result.stderr}`)
  const revision = result.stdout.trim().split(/\s+/)[0]
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Upstream main did not resolve to a commit")
  return revision
}

async function upstreamFile(revision, path) {
  const url = `https://raw.githubusercontent.com/OutlitAI/skills/${revision}/${path}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not fetch ${path}@${revision}: HTTP ${response.status}`)
  return new TextDecoder("utf-8", { fatal: true }).decode(await response.arrayBuffer())
}

async function upstreamSnapshot(revision) {
  const source = await upstreamFile(revision, sourceSkill)
  const files = { [sourceSkill]: source }
  for (const path of referencePaths(source)) {
    files[`${sourceRoot}/${path}`] = await upstreamFile(revision, `${sourceRoot}/${path}`)
  }
  return buildSnapshot(revision, files)
}

async function existingManifest() {
  try {
    return JSON.parse(await readFile(manifestFile, "utf8"))
  } catch (error) {
    if (error.code === "ENOENT") return null
    throw error
  }
}

async function verifyArtifact(snapshot, manifest) {
  if (JSON.stringify(snapshot.manifest) !== JSON.stringify(manifest)) {
    throw new Error("docs/skill-source.json differs from the pinned upstream files")
  }
  if ((await readFile(skillFile, "utf8")) !== snapshot.skill) {
    throw new Error("docs/skill.md differs from the deterministic upstream transform")
  }
}

async function main() {
  const mode = process.argv[2]
  if (!["--sync", "--check", "--check-latest"].includes(mode) || process.argv.length !== 3) {
    throw new Error("Usage: node scripts/sync-outlit-skill.mjs --sync|--check|--check-latest")
  }

  const manifest = await existingManifest()
  if (mode === "--check" || mode === "--check-latest") {
    if (!manifest?.revision) throw new Error("Missing docs/skill-source.json")
    await verifyArtifact(await upstreamSnapshot(manifest.revision), manifest)
    if (mode === "--check-latest") {
      const latest = await upstreamSnapshot(latestRevision())
      if (!contentsMatch(manifest, latest.manifest)) {
        throw new Error(`Outlit skill content changed upstream at ${latest.manifest.revision}; run --sync`)
      }
    }
    console.log(`Outlit docs skill verified at ${manifest.revision}`)
    return
  }

  const latest = await upstreamSnapshot(latestRevision())
  const snapshot = manifest && contentsMatch(manifest, latest.manifest)
    ? await upstreamSnapshot(manifest.revision)
    : latest
  const nextManifest = `${JSON.stringify(snapshot.manifest, null, 2)}\n`
  const previousSkill = await readFile(skillFile, "utf8").catch((error) => {
    if (error.code === "ENOENT") return null
    throw error
  })
  const changed = previousSkill !== snapshot.skill || JSON.stringify(manifest) !== JSON.stringify(snapshot.manifest)
  if (changed) {
    await writeFile(skillFile, snapshot.skill)
    await writeFile(manifestFile, nextManifest)
  }
  console.log(changed ? `Updated Outlit docs skill from ${snapshot.manifest.revision}` : `Outlit docs skill unchanged at ${snapshot.manifest.revision}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
