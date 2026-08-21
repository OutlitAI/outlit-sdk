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

function findFencedBlockInSection(
  file: string,
  heading: string,
  level: 2 | 3,
  language = "json",
): FencedBlock | undefined {
  const lines = readFileSync(file, "utf8").split(/\r?\n/)
  const marker = `${"#".repeat(level)} ${heading}`
  const startIndex = lines.indexOf(marker)
  if (startIndex === -1) return undefined

  const nextMarker = `${"#".repeat(level)} `
  const relativeEndIndex = lines
    .slice(startIndex + 1)
    .findIndex((line) => line.startsWith(nextMarker))
  const endLine = relativeEndIndex === -1 ? lines.length + 1 : startIndex + relativeEndIndex + 2

  return extractFencedBlocks(file).find(
    (block) => block.language === language && block.line > startIndex + 1 && block.line < endLine,
  )
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

  test("keeps tool-gateway request examples aligned with generated input schemas", () => {
    const file = "docs/api-reference/tools.mdx"
    const cases = [
      ["Get Customer Details", "outlit_get_customer"],
      ["Search Customer Context", "outlit_search_customer_context"],
      ["List Active Facts From Calls And Opportunities", "outlit_list_facts"],
      ["Open One Source Record", "outlit_get_source"],
      ["Read Customer Features", "outlit_get_customer_features"],
    ] as const
    const failures: string[] = []

    for (const [heading, toolName] of cases) {
      const requestBlock = findFencedBlockInSection(file, heading, 3)
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

  test("keeps CLI JSON response examples aligned with generated output schemas", () => {
    const file = "docs/cli/commands.mdx"
    const cases = [
      ["Customers List", "outlit_list_customers"],
      ["Customers Get", "outlit_get_customer"],
      ["Customers Relationship", "outlit_get_customer_relationship"],
      ["Attention", "outlit_list_attention_items"],
      ["Customers Timeline", "outlit_get_timeline"],
      ["Users List", "outlit_list_users"],
      ["Facts", "outlit_list_facts"],
      ["Search", "outlit_search_customer_context"],
      ["SQL", "outlit_query"],
      ["Schema", "outlit_schema"],
    ] as const
    const failures: string[] = []

    for (const [heading, toolName] of cases) {
      const responseBlock = findFencedBlockInSection(file, heading, 2)

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

  test("keeps embedded Astro and Svelte scripts syntactically valid", () => {
    const failures: string[] = []
    let scriptCount = 0

    for (const file of listPublicDocumentationFiles()) {
      for (const block of extractFencedBlocks(file)) {
        if (block.language !== "astro" && block.language !== "svelte") continue

        const scripts: string[] = []
        if (block.language === "astro" && block.code.startsWith("---\n")) {
          const frontmatterEnd = block.code.indexOf("\n---", 4)
          if (frontmatterEnd !== -1) scripts.push(block.code.slice(4, frontmatterEnd))
        }
        for (const match of block.code.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
          scripts.push(match[1] ?? "")
        }

        for (const script of scripts) {
          scriptCount += 1
          const sourceFile = ts.createSourceFile(
            `${file}:${block.line}.${block.language}.ts`,
            script,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
          )
          for (const diagnostic of sourceFile.parseDiagnostics) {
            failures.push(
              `${file}:${block.line}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
            )
          }
        }
      }
    }

    expect(scriptCount).toBeGreaterThan(0)
    expect(failures).toEqual([])
  })

  test("keeps documented @outlit package imports resolvable", () => {
    const scriptKinds: Record<string, ts.ScriptKind> = {
      javascript: ts.ScriptKind.JS,
      js: ts.ScriptKind.JS,
      jsx: ts.ScriptKind.JSX,
      ts: ts.ScriptKind.TS,
      tsx: ts.ScriptKind.TSX,
      typescript: ts.ScriptKind.TS,
    }
    const imports: string[] = []
    const usages: string[] = []
    let importId = 0

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

        for (const statement of sourceFile.statements) {
          if (
            !ts.isImportDeclaration(statement) ||
            !ts.isStringLiteral(statement.moduleSpecifier)
          ) {
            continue
          }

          const moduleName = statement.moduleSpecifier.text
          const importClause = statement.importClause
          if (!moduleName.startsWith("@outlit/") || !importClause) continue

          const origin = `${file}:${block.line}`
          if (importClause.name) {
            const alias = `documentedDefault${importId++}`
            imports.push(`import ${alias} from ${JSON.stringify(moduleName)} // ${origin}`)
            usages.push(`void ${alias}`)
          }

          if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
            const alias = `documentedNamespace${importId++}`
            imports.push(`import * as ${alias} from ${JSON.stringify(moduleName)} // ${origin}`)
            usages.push(`void ${alias}`)
          }

          if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            for (const element of importClause.namedBindings.elements) {
              const importedName = element.propertyName?.text ?? element.name.text
              const alias = `documentedImport${importId++}`
              const typeOnly = importClause.isTypeOnly || element.isTypeOnly
              imports.push(
                `${typeOnly ? "import type" : "import"} { ${importedName} as ${alias} } from ${JSON.stringify(moduleName)} // ${origin}`,
              )
              usages.push(typeOnly ? `type DocumentedType${importId} = ${alias}` : `void ${alias}`)
            }
          }
        }
      }
    }

    const virtualFile = join(process.cwd(), "tests/docs/.public-imports-doctest.ts")
    const virtualSource = [...imports, ...usages].join("\n")
    const compilerOptions: ts.CompilerOptions = {
      baseUrl: process.cwd(),
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
      paths: {
        "@outlit/browser": ["packages/browser/dist/index.d.ts"],
        "@outlit/browser/react": ["packages/browser/dist/react/index.d.ts"],
        "@outlit/browser/vue": ["packages/browser/dist/vue/index.d.ts"],
        "@outlit/core": ["packages/core/dist/index.d.ts"],
        "@outlit/node": ["packages/node/dist/index.d.ts"],
        "@outlit/pi": ["packages/pi/dist/index.d.ts"],
        "@outlit/tools": ["packages/tools/dist/index.d.ts"],
      },
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
    }
    const compilerHost = ts.createCompilerHost(compilerOptions)
    const getSourceFile = compilerHost.getSourceFile.bind(compilerHost)
    compilerHost.fileExists = (fileName) => fileName === virtualFile || ts.sys.fileExists(fileName)
    compilerHost.readFile = (fileName) =>
      fileName === virtualFile ? virtualSource : ts.sys.readFile(fileName)
    compilerHost.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
      fileName === virtualFile
        ? ts.createSourceFile(fileName, virtualSource, languageVersion, true, ts.ScriptKind.TS)
        : getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)

    const program = ts.createProgram([virtualFile], compilerOptions, compilerHost)
    const failures = ts
      .getPreEmitDiagnostics(program)
      .filter((diagnostic) => !diagnostic.file || diagnostic.file.fileName === virtualFile)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "))

    expect(imports.length).toBeGreaterThan(0)
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
