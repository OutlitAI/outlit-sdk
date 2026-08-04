import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, test } from "vitest"
import { ingestTransport } from "../../packages/tools/src/generated/contracts"

const repositoryRoot = resolve(import.meta.dirname, "../..")
const retiredTrackingIdentifiers = [
  "StageEvent",
  "BillingEvent",
  "ExplicitJourneyStage",
  "BillingStatus",
]

function declarationText(packageName: "core" | "browser" | "node"): string {
  const distRoot = resolve(repositoryRoot, "packages", packageName, "dist")
  const declarationFiles = readdirSync(distRoot, { recursive: true })
    .filter((entry) => entry.endsWith(".d.ts"))
    .map((entry) => resolve(distRoot, entry))

  expect(declarationFiles.length).toBeGreaterThan(0)
  return declarationFiles.map((file) => readFileSync(file, "utf8")).join("\n")
}

describe("public tracking surface", () => {
  test.each([
    "core",
    "browser",
    "node",
  ] as const)("@outlit/%s declarations do not publish retired lifecycle or billing APIs", (packageName) => {
    const declarations = declarationText(packageName)

    for (const identifier of retiredTrackingIdentifiers) {
      expect(declarations).not.toContain(identifier)
    }
  })

  test("the Rust event enum exposes only custom and identify variants", () => {
    const rustTypes = readFileSync(resolve(repositoryRoot, "crates/outlit/src/types.rs"), "utf8")
    const eventEnum = rustTypes.match(/pub enum TrackerEvent \{(?<body>[\s\S]*?)\n\}/)?.groups?.body

    expect(eventEnum).toBeDefined()
    expect(eventEnum?.match(/^\s+[A-Z][A-Za-z]+\(/gm)?.map((variant) => variant.trim())).toEqual([
      "Custom(",
      "Identify(",
    ])
    expect(eventEnum).not.toMatch(/Stage|Billing/)
  })

  test("the generated Rust transport stays aligned with Core-owned ingest data", () => {
    const rustContract = readFileSync(
      resolve(repositoryRoot, "crates/outlit/src/generated_ingest_contract.rs"),
      "utf8",
    )

    expect(rustContract).toContain(`INGEST_METHOD: &str = "${ingestTransport.method}"`)
    expect(rustContract).toContain(`INGEST_PATH_TEMPLATE: &str = "${ingestTransport.pathTemplate}"`)
    for (const eventType of ingestTransport.eventTypes) {
      expect(rustContract).toContain(`"${eventType}"`)
    }
    expect(rustContract).not.toMatch(/"stage"|"billing"/)
  })
})
