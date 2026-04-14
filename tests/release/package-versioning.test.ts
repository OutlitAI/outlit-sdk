import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

function readPackageJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"))
}

describe("agent package versioning", () => {
  test("starts tools and Pi packages from the same 0.x release line", () => {
    const toolsPackage = readPackageJson("packages/tools/package.json")
    const piPackage = readPackageJson("packages/pi/package.json")
    const cliPackage = readPackageJson("packages/cli/package.json")

    expect(toolsPackage.version).toBe("0.0.1")
    expect(piPackage.version).toBe("0.0.1")
    expect(piPackage.dependencies["@outlit/tools"]).toBe("^0.0.1")
    expect(cliPackage.dependencies["@outlit/tools"]).toBe("^0.0.1")
  })
})
