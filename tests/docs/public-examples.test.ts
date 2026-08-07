import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as vueSfcCompiler from "@vue/compiler-sfc"
import ts from "typescript"
import { describe, expect, test } from "vitest"
import { matchesGeneratedJsonSchema } from "../../packages/tools/src/client"
import { publicToolContracts, timelineChannels } from "../../packages/tools/src/generated/contracts"

type FencedBlock = {
  code: string
  language: string
  line: number
}

type VueSfcDescriptor = {
  script?: unknown
  scriptSetup?: unknown
  template?: { content: string }
}

type VueSfcCompiler = {
  compileScript: (descriptor: VueSfcDescriptor, options: { id: string }) => unknown
  compileTemplate: (options: { filename: string; id: string; source: string }) => {
    errors: Array<Error | string>
  }
  parse: (
    source: string,
    options: { filename: string },
  ) => { descriptor: VueSfcDescriptor; errors: Array<Error | string> }
}

const vueCompiler = vueSfcCompiler as unknown as VueSfcCompiler

function listPublicDocumentationFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z", "*.md", "*.mdx"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .filter(
      (file) =>
        file === "README.md" ||
        file === "CONTRIBUTING.md" ||
        (file.startsWith("docs/") && !file.startsWith("docs/superpowers/")) ||
        /^(?:crates|packages)\/[^/]+\/README\.md$/.test(file) ||
        file.startsWith("packages/pi/skills/") ||
        file.startsWith("examples/"),
    )
}

function extractFencedBlocks(file: string): FencedBlock[] {
  const lines = readFileSync(file, "utf8").split(/\r?\n/)
  const blocks: FencedBlock[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index]?.match(/^\s*(`{3,}|~{3,})([^\s`~]*)/)
    if (!opening) continue

    const delimiter = opening[1] ?? ""
    const delimiterCharacter = delimiter[0]
    if (!delimiterCharacter) continue

    const closing = new RegExp(`^\\s*${delimiterCharacter}{${delimiter.length},}\\s*$`)
    const body: string[] = []
    const line = index + 1
    while (++index < lines.length && !closing.test(lines[index] ?? "")) {
      body.push(lines[index] ?? "")
    }

    blocks.push({
      code: body.join("\n"),
      language: opening[2] ?? "",
      line,
    })
  }

  return blocks
}

describe("public documentation examples", () => {
  test("extracts tilde and longer backtick fences", () => {
    const fixtureDirectory = mkdtempSync(join(tmpdir(), "outlit-docs-doctest-"))
    const fixture = join(fixtureDirectory, "fences.md")

    try {
      writeFileSync(
        fixture,
        [
          "~~~~json",
          '{"valid":true}',
          "~~~~",
          "````typescript",
          'const embeddedFence = "```"',
          "````",
        ].join("\n"),
      )

      expect(extractFencedBlocks(fixture)).toEqual([
        { code: '{"valid":true}', language: "json", line: 1 },
        { code: 'const embeddedFence = "```"', language: "typescript", line: 4 },
      ])
    } finally {
      rmSync(fixtureDirectory, { force: true, recursive: true })
    }
  })

  test("keeps JSON fences parseable as JSON", () => {
    const failures: string[] = []

    for (const file of listPublicDocumentationFiles()) {
      for (const block of extractFencedBlocks(file)) {
        if (block.language !== "json") continue

        try {
          JSON.parse(block.code)
        } catch (error) {
          failures.push(`${file}:${block.line}: ${(error as Error).message}`)
        }
      }
    }

    expect(failures).toEqual([])
  })

  test("keeps tool-gateway request examples aligned with generated input schemas", () => {
    const file = "docs/api-reference/tools.mdx"
    const source = readFileSync(file, "utf8")
    const blocks = extractFencedBlocks(file)
    const cases = [
      ["Get Customer Details", "Search Customer Context", "outlit_get_customer"],
      ["Search Customer Context", "List Active Facts", "outlit_search_customer_context"],
      ["List Active Facts", "Open One Source", "outlit_list_facts"],
      ["Open One Source", "Response", "outlit_get_source"],
    ] as const
    const failures: string[] = []

    for (const [heading, nextHeading, toolName] of cases) {
      const startLine = source.slice(0, source.indexOf(`### ${heading}`)).split(/\r?\n/).length
      const nextMarker = nextHeading === "Response" ? `## ${nextHeading}` : `### ${nextHeading}`
      const endLine = source.slice(0, source.indexOf(nextMarker)).split(/\r?\n/).length
      const requestBlock = blocks.find(
        (block) => block.language === "json" && block.line > startLine && block.line < endLine,
      )
      const request = JSON.parse(requestBlock?.code ?? "null") as {
        input?: unknown
        tool?: string
      } | null

      if (
        !requestBlock ||
        request?.tool !== toolName ||
        !matchesGeneratedJsonSchema(request?.input, publicToolContracts[toolName].inputSchema)
      ) {
        failures.push(`${heading}: ${toolName}`)
      }
    }

    expect(failures).toEqual([])
  })

  test("keeps the documented customer-list response aligned with its generated schema", () => {
    const file = "docs/api-reference/tools.mdx"
    const source = readFileSync(file, "utf8")
    const markerLine = source
      .slice(0, source.indexOf("Example list response:"))
      .split(/\r?\n/).length
    const responseBlock = extractFencedBlocks(file).find(
      (block) => block.language === "json" && block.line > markerLine,
    )

    expect(responseBlock).toBeDefined()
    expect(
      matchesGeneratedJsonSchema(
        JSON.parse(responseBlock?.code ?? "null") as unknown,
        publicToolContracts.outlit_list_customers.outputSchema,
      ),
    ).toBe(true)
  })

  test("keeps CLI JSON response examples aligned with generated tool schemas", () => {
    const file = "docs/cli/commands.mdx"
    const source = readFileSync(file, "utf8")
    const blocks = extractFencedBlocks(file)
    const cases = [
      ["Customers List", "Customers Get", "outlit_list_customers"],
      ["Customers Get", "Customers Timeline", "outlit_get_customer"],
      ["Customers Timeline", "Users List", "outlit_get_timeline"],
      ["Users List", "Facts", "outlit_list_users"],
      ["Facts", "Search", "outlit_get_fact"],
      ["Search", "Sources", "outlit_search_customer_context"],
    ] as const
    const failures: string[] = []

    for (const [heading, nextHeading, toolName] of cases) {
      const startLine = source.slice(0, source.indexOf(`## ${heading}`)).split(/\r?\n/).length
      const endLine = source.slice(0, source.indexOf(`## ${nextHeading}`)).split(/\r?\n/).length
      const responseBlock = blocks.find(
        (block) => block.language === "json" && block.line > startLine && block.line < endLine,
      )

      if (
        !responseBlock ||
        !matchesGeneratedJsonSchema(
          JSON.parse(responseBlock.code) as unknown,
          publicToolContracts[toolName].outputSchema,
        )
      ) {
        failures.push(`${heading}: ${toolName}`)
      }
    }

    expect(failures).toEqual([])
  })

  test("keeps CLI timeline channel examples aligned with the generated contract", () => {
    const failures: string[] = []
    const allowedChannels = new Set<string>(timelineChannels)

    for (const file of listPublicDocumentationFiles()) {
      const source = readFileSync(file, "utf8")
      for (const match of source.matchAll(/--channels(?:=|\s+)([A-Za-z_,]+)/g)) {
        for (const channel of (match[1] ?? "").split(",").filter(Boolean)) {
          if (!allowedChannels.has(channel)) {
            failures.push(`${file}: --channels uses legacy value ${channel}`)
          }
        }
      }
    }

    const commandReference = "docs/cli/commands.mdx"
    for (const block of extractFencedBlocks(commandReference)) {
      if (block.language !== "json") continue

      for (const match of block.code.matchAll(/"channel":\s*"([A-Z_]+)"/g)) {
        const channel = match[1]
        if (channel && !allowedChannels.has(channel)) {
          failures.push(`${commandReference}:${block.line}: response uses ${channel}`)
        }
      }
    }

    expect(failures).toEqual([])
  })

  test("keeps TypeScript and JavaScript fences syntactically valid", () => {
    const scriptKinds: Record<string, ts.ScriptKind> = {
      javascript: ts.ScriptKind.JS,
      js: ts.ScriptKind.JS,
      jsx: ts.ScriptKind.JSX,
      ts: ts.ScriptKind.TS,
      tsx: ts.ScriptKind.TSX,
      typescript: ts.ScriptKind.TS,
    }
    const failures: string[] = []

    for (const file of listPublicDocumentationFiles()) {
      for (const block of extractFencedBlocks(file)) {
        const scriptKind = scriptKinds[block.language]
        if (scriptKind === undefined) continue

        const sourceFile = ts.createSourceFile(
          `${file}.${block.language}`,
          block.code,
          ts.ScriptTarget.Latest,
          true,
          scriptKind,
        )

        for (const diagnostic of sourceFile.parseDiagnostics) {
          failures.push(
            `${file}:${block.line}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
          )
        }
      }
    }

    expect(failures).toEqual([])
  })

  test("keeps Vue fences compilable as single-file components", () => {
    const failures: string[] = []
    let blockId = 0

    for (const file of listPublicDocumentationFiles()) {
      for (const block of extractFencedBlocks(file)) {
        if (block.language !== "vue") continue

        blockId += 1
        const filename = `${file}:${block.line}.vue`
        const parsed = vueCompiler.parse(block.code, { filename })
        const errors = [...parsed.errors]

        try {
          if (parsed.descriptor.script || parsed.descriptor.scriptSetup) {
            vueCompiler.compileScript(parsed.descriptor, { id: `docs-${blockId}` })
          }
        } catch (error) {
          errors.push(error as Error)
        }

        if (parsed.descriptor.template) {
          errors.push(
            ...vueCompiler.compileTemplate({
              filename,
              id: `docs-${blockId}`,
              source: parsed.descriptor.template.content,
            }).errors,
          )
        }

        for (const error of errors) {
          failures.push(
            `${file}:${block.line}: ${typeof error === "string" ? error : error.message}`,
          )
        }
      }
    }

    expect(failures).toEqual([])
  })

  test("keeps shell fences parseable by Bash", () => {
    const failures: string[] = []

    for (const file of listPublicDocumentationFiles()) {
      for (const block of extractFencedBlocks(file)) {
        if (!new Set(["bash", "sh", "shell"]).has(block.language)) continue

        const result = spawnSync("bash", ["-n"], {
          encoding: "utf8",
          input: block.code,
        })
        if (result.status !== 0) {
          failures.push(`${file}:${block.line}: ${result.stderr.trim()}`)
        }
      }
    }

    expect(failures).toEqual([])
  })
})
