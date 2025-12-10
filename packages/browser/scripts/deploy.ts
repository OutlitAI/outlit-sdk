#!/usr/bin/env tsx
/**
 * Deployment script for Outlit Tracker to Google Cloud Storage
 *
 * Environments:
 *   canary  - For testing/development. Safe to overwrite frequently.
 *   stable  - Production. Only promoted manually after canary validation.
 *   version - Creates an immutable versioned snapshot (e.g., v0.1.0)
 *
 * Usage:
 *   pnpm deploy:canary          # Deploy to /canary/outlit.js
 *   pnpm deploy:stable          # Deploy to /stable/outlit.js (requires confirmation)
 *   pnpm deploy:version         # Deploy to /v{version}/outlit.js
 *   pnpm deploy:version 1.2.3   # Deploy to /v1.2.3/outlit.js
 *
 * Options:
 *   --ci, --yes                 # Skip all confirmations (for CI environments)
 */

import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import * as readline from "node:readline"

// Configuration
const BUCKET_NAME = "cdn.outlit.ai"
const LOCAL_BUNDLE_FILE = "outlit.global.js" // Build output from tsup
const REMOTE_BUNDLE_FILE = "outlit.js" // File name in the bucket
const DIST_PATH = join(__dirname, "..", "dist", LOCAL_BUNDLE_FILE)

interface DeployConfig {
  environment: "canary" | "stable" | "version"
  version?: string
  ci: boolean
}

function getPackageVersion(): string {
  const pkgPath = join(__dirname, "..", "package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
  return pkg.version
}

function getBundlePath(config: DeployConfig): string {
  switch (config.environment) {
    case "canary":
      return `canary/${REMOTE_BUNDLE_FILE}`
    case "stable":
      return `stable/${REMOTE_BUNDLE_FILE}`
    case "version": {
      const ver = config.version || getPackageVersion()
      return `v${ver}/${REMOTE_BUNDLE_FILE}`
    }
  }
}

function getGcsUrl(path: string): string {
  return `gs://${BUCKET_NAME}/${path}`
}

function getPublicUrl(path: string): string {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${path}`
}

function checkBundleExists(): void {
  if (!existsSync(DIST_PATH)) {
    console.error(`\n Bundle not found at ${DIST_PATH}`)
    console.error("   Run 'pnpm build' first.\n")
    process.exit(1)
  }
}

function checkGcloudInstalled(): void {
  try {
    execSync("gcloud --version", { stdio: "ignore" })
  } catch {
    console.error("\n gcloud CLI not found.")
    console.error("   Install from: https://cloud.google.com/sdk/docs/install\n")
    process.exit(1)
  }
}

async function confirmDeploy(message: string, ci: boolean): Promise<boolean> {
  if (ci) {
    console.log(`${message} (auto-confirmed in CI mode)`)
    return true
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === "y")
    })
  })
}

function deploy(localPath: string, gcsPath: string): void {
  const gcsUrl = getGcsUrl(gcsPath)

  console.log(`\n Uploading ${LOCAL_BUNDLE_FILE} to ${gcsUrl}...`)

  // Upload with cache headers
  // - canary: short cache (5 min) for quick iteration
  // - stable/version: long cache (1 year) for production
  const isCanary = gcsPath.startsWith("canary/")
  const cacheControl = isCanary
    ? "public, max-age=300" // 5 minutes
    : "public, max-age=31536000, immutable" // 1 year

  const cmd = [
    "gcloud storage cp",
    `"${localPath}"`,
    `"${gcsUrl}"`,
    `--cache-control="${cacheControl}"`,
    '--content-type="application/javascript"',
  ].join(" ")

  try {
    execSync(cmd, { stdio: "inherit" })
    console.log("\n Deployed successfully!")
    console.log(`   URL: ${getPublicUrl(gcsPath)}\n`)
  } catch {
    console.error("\n Deployment failed. Check gcloud authentication:")
    console.error("   gcloud auth login")
    console.error("   gcloud config set project YOUR_PROJECT_ID\n")
    process.exit(1)
  }
}

function parseArgs(args: string[]): DeployConfig {
  const ci = args.includes("--ci") || args.includes("--yes") || process.env.CI === "true"
  const filteredArgs = args.filter((arg) => !arg.startsWith("--"))

  const environment = filteredArgs[0] as DeployConfig["environment"]
  const version = filteredArgs[1]

  return { environment, version, ci }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const config = parseArgs(args)

  if (!["canary", "stable", "version"].includes(config.environment)) {
    console.error("\n Invalid environment. Use: canary, stable, or version")
    console.error("\nUsage:")
    console.error("  pnpm deploy:canary              # Deploy to /canary/")
    console.error("  pnpm deploy:stable              # Deploy to /stable/ (production)")
    console.error("  pnpm deploy:version             # Deploy to /v{pkg.version}/")
    console.error("  pnpm deploy:version 1.2.3       # Deploy to /v1.2.3/")
    console.error("\nOptions:")
    console.error("  --ci, --yes                     # Skip all confirmations (for CI)\n")
    process.exit(1)
  }

  // Preflight checks
  checkGcloudInstalled()
  checkBundleExists()

  const gcsPath = getBundlePath(config)
  const publicUrl = getPublicUrl(gcsPath)

  console.log("\n============================================")
  console.log("         Outlit Tracker Deployment          ")
  console.log("============================================")
  console.log(`\n  Environment: ${config.environment.toUpperCase()}`)
  console.log(`  Target:      ${gcsPath}`)
  console.log(`  Public URL:  ${publicUrl}`)
  if (config.ci) {
    console.log(`  Mode:        CI (non-interactive)`)
  }

  // Require confirmation for stable (production) deploys
  if (config.environment === "stable") {
    console.log("\n  WARNING: You are deploying to PRODUCTION (stable)")
    console.log("   This will immediately affect all users using the stable URL.")

    const confirmed = await confirmDeploy("\nAre you sure you want to continue?", config.ci)
    if (!confirmed) {
      console.log("\n Deployment cancelled.\n")
      process.exit(0)
    }
  }

  // Check if version already exists (prevent overwriting versioned releases)
  if (config.environment === "version") {
    try {
      execSync(`gcloud storage ls "${getGcsUrl(gcsPath)}" 2>/dev/null`, {
        stdio: "pipe",
      })
      console.log(`\n  Version ${config.version || getPackageVersion()} already exists.`)
      const confirmed = await confirmDeploy("Overwrite existing version?", config.ci)
      if (!confirmed) {
        console.log("\n Deployment cancelled.\n")
        process.exit(0)
      }
    } catch {
      // File doesn't exist, safe to proceed
    }
  }

  deploy(DIST_PATH, gcsPath)
}

main()
