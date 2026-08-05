import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { ingestTransport } from "../packages/tools/src/generated/contracts"

const repositoryRoot = resolve(import.meta.dirname, "..")
const rustPath = resolve(repositoryRoot, "crates/outlit/src/generated_ingest_contract.rs")
const coreTypeScriptPath = resolve(repositoryRoot, "packages/core/src/generated/ingest-contract.ts")
const coreWireTypesPath = resolve(
  repositoryRoot,
  "packages/core/src/generated/ingest-wire-types.ts",
)

type JsonSchema = Record<string, unknown>

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function schemaAlternatives(schema: JsonSchema): unknown[] | null {
  if (Array.isArray(schema.oneOf)) return schema.oneOf
  if (Array.isArray(schema.anyOf)) return schema.anyOf
  return null
}

function jsonSchemaToType(schemaValue: unknown, path = "$", depth = 0): string {
  if (schemaValue === true) return "unknown"
  if (schemaValue === false) return "never"
  if (!isJsonSchema(schemaValue)) {
    throw new Error(`Unsupported JSON Schema at ${path}: expected an object or boolean schema`)
  }

  for (const unsupportedKeyword of ["$ref", "allOf", "if", "then", "else", "not"] as const) {
    if (unsupportedKeyword in schemaValue) {
      throw new Error(`Unsupported JSON Schema keyword ${unsupportedKeyword} at ${path}`)
    }
  }

  if ("const" in schemaValue) return JSON.stringify(schemaValue.const)
  if (Array.isArray(schemaValue.enum)) {
    return schemaValue.enum.map((value) => JSON.stringify(value)).join(" | ") || "never"
  }

  const alternatives = schemaAlternatives(schemaValue)
  if (alternatives) {
    return alternatives
      .map((schema, index) => jsonSchemaToType(schema, `${path}.alternatives[${index}]`, depth))
      .join(" | ")
  }

  if (Array.isArray(schemaValue.type)) {
    return schemaValue.type
      .map((type, index) =>
        jsonSchemaToType({ ...schemaValue, type }, `${path}.type[${index}]`, depth),
      )
      .join(" | ")
  }

  if (schemaValue.type === "array") {
    return `Array<${jsonSchemaToType(schemaValue.items, `${path}.items`, depth)}>`
  }

  if (schemaValue.type === "object" || isJsonSchema(schemaValue.properties)) {
    const properties = isJsonSchema(schemaValue.properties) ? schemaValue.properties : {}
    const propertyEntries = Object.entries(properties)
    const additionalProperties = schemaValue.additionalProperties

    if (propertyEntries.length === 0) {
      if (isJsonSchema(additionalProperties)) {
        return `Record<string, ${jsonSchemaToType(
          additionalProperties,
          `${path}.additionalProperties`,
          depth,
        )}>`
      }
      return additionalProperties === false ? "Record<string, never>" : "Record<string, unknown>"
    }

    const required = new Set(Array.isArray(schemaValue.required) ? schemaValue.required : [])
    const indentation = "  ".repeat(depth)
    const propertyIndentation = "  ".repeat(depth + 1)
    const lines = propertyEntries.map(([property, propertySchema]) => {
      const optional = required.has(property) ? "" : "?"
      return `${propertyIndentation}${JSON.stringify(property)}${optional}: ${jsonSchemaToType(propertySchema, `${path}.properties.${property}`, depth + 1)}`
    })
    return `{\n${lines.join("\n")}\n${indentation}}`
  }

  if (schemaValue.type === "string") return "string"
  if (schemaValue.type === "number" || schemaValue.type === "integer") return "number"
  if (schemaValue.type === "boolean") return "boolean"
  if (schemaValue.type === "null") return "null"
  if (Object.keys(schemaValue).length === 0) return "unknown"
  throw new Error(`Unsupported JSON Schema type ${JSON.stringify(schemaValue.type)} at ${path}`)
}

function readIngestMaxBatchSize(schema: unknown): number {
  if (!isJsonSchema(schema) || !isJsonSchema(schema.properties)) {
    throw new Error("Ingest request schema is missing object properties")
  }
  const events = schema.properties.events
  if (!isJsonSchema(events) || !Number.isInteger(events.maxItems) || Number(events.maxItems) < 1) {
    throw new Error("Ingest request schema events.maxItems must be a positive integer")
  }
  return Number(events.maxItems)
}

async function formatTypeScript(source: string, filePath: string): Promise<string> {
  const formatter = Bun.spawn(["bunx", "biome", "format", "--stdin-file-path", filePath], {
    stdin: new Blob([source]),
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    formatter.exited,
    new Response(formatter.stdout).text(),
    new Response(formatter.stderr).text(),
  ])
  if (exitCode !== 0) {
    throw new Error(`Failed to format generated TypeScript: ${stderr}`)
  }
  return stdout
}

const coreTypeScriptSource = `// Generated from packages/tools/src/generated/contracts.ts. Do not edit by hand.

export const ingestTransport = {
  method: ${JSON.stringify(ingestTransport.method)},
  pathTemplate: ${JSON.stringify(ingestTransport.pathTemplate)},
  maxBatchSize: ${readIngestMaxBatchSize(ingestTransport.requestSchema)},
  eventTypes: [${ingestTransport.eventTypes.map((eventType) => JSON.stringify(eventType)).join(", ")}],
} as const
`
const coreWireTypesSource = await formatTypeScript(
  `// Generated from packages/tools/src/generated/contracts.ts. Do not edit by hand.

export type GeneratedIngestPayload = ${jsonSchemaToType(ingestTransport.requestSchema)}

export type GeneratedIngestResponse = ${jsonSchemaToType(ingestTransport.responseSchema)}
`,
  coreWireTypesPath,
)
const rustSource = `// Generated from packages/tools/src/generated/contracts.ts. Do not edit by hand.

pub const INGEST_METHOD: &str = ${JSON.stringify(ingestTransport.method)};
pub const INGEST_PATH_TEMPLATE: &str = ${JSON.stringify(ingestTransport.pathTemplate)};
pub const INGEST_MAX_BATCH_SIZE: usize = ${readIngestMaxBatchSize(ingestTransport.requestSchema)};
#[allow(dead_code)]
pub const INGEST_EVENT_TYPES: &[&str] = &[
${ingestTransport.eventTypes.map((eventType) => `    ${JSON.stringify(eventType)},`).join("\n")}
];

pub fn ingest_path(public_key: &str) -> String {
    INGEST_PATH_TEMPLATE.replace("{publicKey}", public_key)
}
`

if (process.argv.includes("--check")) {
  const [currentRust, currentCoreTypeScript, currentCoreWireTypes] = await Promise.all([
    readFile(rustPath, "utf8").catch(() => ""),
    readFile(coreTypeScriptPath, "utf8").catch(() => ""),
    readFile(coreWireTypesPath, "utf8").catch(() => ""),
  ])
  if (
    currentRust !== rustSource ||
    currentCoreTypeScript !== coreTypeScriptSource ||
    currentCoreWireTypes !== coreWireTypesSource
  ) {
    console.error("Generated ingest contract drift detected. Run bun run contracts:generate.")
    process.exit(1)
  }
  console.log("Generated ingest consumers match the Core-owned contract.")
} else {
  await mkdir(resolve(coreTypeScriptPath, ".."), { recursive: true })
  await Promise.all([
    writeFile(rustPath, rustSource),
    writeFile(coreTypeScriptPath, coreTypeScriptSource),
    writeFile(coreWireTypesPath, coreWireTypesSource),
  ])
  console.log(`Wrote ${rustPath}`)
  console.log(`Wrote ${coreTypeScriptPath}`)
  console.log(`Wrote ${coreWireTypesPath}`)
}
