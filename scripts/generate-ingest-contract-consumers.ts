import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { ingestTransport } from "../packages/tools/src/generated/contracts"

const repositoryRoot = resolve(import.meta.dirname, "..")
const rustPath = resolve(repositoryRoot, "crates/outlit/src/generated_ingest_contract.rs")
const coreTypeScriptPath = resolve(repositoryRoot, "packages/core/src/generated/ingest-contract.ts")
const coreTypeScriptSource = `// Generated from packages/tools/src/generated/contracts.ts. Do not edit by hand.

export const ingestTransport = {
  method: ${JSON.stringify(ingestTransport.method)},
  pathTemplate: ${JSON.stringify(ingestTransport.pathTemplate)},
  eventTypes: [${ingestTransport.eventTypes.map((eventType) => JSON.stringify(eventType)).join(", ")}],
} as const
`
const rustSource = `// Generated from packages/tools/src/generated/contracts.ts. Do not edit by hand.

pub const INGEST_METHOD: &str = ${JSON.stringify(ingestTransport.method)};
pub const INGEST_PATH_TEMPLATE: &str = ${JSON.stringify(ingestTransport.pathTemplate)};
#[allow(dead_code)]
pub const INGEST_EVENT_TYPES: &[&str] = &[
${ingestTransport.eventTypes.map((eventType) => `    ${JSON.stringify(eventType)},`).join("\n")}
];

pub fn ingest_path(public_key: &str) -> String {
    INGEST_PATH_TEMPLATE.replace("{publicKey}", public_key)
}
`

if (process.argv.includes("--check")) {
  const [currentRust, currentCoreTypeScript] = await Promise.all([
    readFile(rustPath, "utf8").catch(() => ""),
    readFile(coreTypeScriptPath, "utf8").catch(() => ""),
  ])
  if (currentRust !== rustSource || currentCoreTypeScript !== coreTypeScriptSource) {
    console.error("Generated ingest contract drift detected. Run bun run contracts:generate.")
    process.exit(1)
  }
  console.log("Generated ingest consumers match the Core-owned contract.")
} else {
  await mkdir(resolve(coreTypeScriptPath, ".."), { recursive: true })
  await Promise.all([
    writeFile(rustPath, rustSource),
    writeFile(coreTypeScriptPath, coreTypeScriptSource),
  ])
  console.log(`Wrote ${rustPath}`)
  console.log(`Wrote ${coreTypeScriptPath}`)
}
