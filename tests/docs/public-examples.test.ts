import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as vueSfcCompiler from "@vue/compiler-sfc"
import ts from "typescript"
import { describe, expect, test } from "vitest"

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
