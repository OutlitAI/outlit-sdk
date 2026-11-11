// `bun build --target node` still marks its output with a `// @bun` pragma line. Bun reads any
// file carrying that pragma as Latin-1, so under the `#!/usr/bin/env bun` shebang (how npm installs
// run the bin) every non-ASCII literal, such as the skill's emoji, prints double-encoded. Node
// ignores the pragma. Removing it makes Bun read the bundle as UTF-8; the shebang stays.
import { readFileSync, writeFileSync } from "node:fs"

const bundle = process.argv[2] ?? "dist/cli.js"
const source = readFileSync(bundle, "utf8")
const stripped = source.replace(/^(#![^\n]*\n)\/\/ @bun\r?\n/, "$1")

if (/^\/\/ @bun$/m.test(stripped.split("\n", 3).join("\n"))) {
  throw new Error(`${bundle} still starts with the // @bun pragma`)
}

writeFileSync(bundle, stripped)
