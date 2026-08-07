import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { userJourneyStages } from "@outlit/tools"

const packageRoot = join(import.meta.dir, "..", "..")

const retiredCommandFamilies = ["agents", "automations", "signals", "identity"] as const
const retiredToolPrefixes = [
  "outlit_agent_",
  "outlit_automation_",
  "outlit_signal_",
  "outlit_identity_merge_suggestion_",
] as const

describe("public CLI surface", () => {
  test("uses current journey-stage contract values in root help examples", () => {
    const cliSource = readFileSync(join(packageRoot, "src", "cli.ts"), "utf8")
    const documentedStages = [
      ...cliSource.matchAll(/outlit users list --journey-stage ([A-Z_]+)/g),
    ].map((match) => match[1] ?? "")
    const allowedStages = new Set<string>(userJourneyStages)

    expect(documentedStages.length).toBeGreaterThan(0)
    for (const stage of documentedStages) {
      expect(allowedStages.has(stage)).toBe(true)
    }
  })

  test("does not register retired command families or notification sending", () => {
    const cliSource = readFileSync(join(packageRoot, "src", "cli.ts"), "utf8")

    for (const command of [...retiredCommandFamilies, "notify"]) {
      expect(cliSource).not.toContain(`${command}: () => import(`)
    }
  })

  test("does not ship retired command modules", () => {
    for (const command of retiredCommandFamilies) {
      const commandDir = join(packageRoot, "src", "commands", command)
      const files = existsSync(commandDir)
        ? readdirSync(commandDir, { recursive: true, withFileTypes: true }).filter((entry) =>
            entry.isFile(),
          )
        : []
      expect(files).toEqual([])
    }

    expect(existsSync(join(packageRoot, "src", "commands", "notify.ts"))).toBe(false)
  })

  test("does not map retired tools to direct Platform endpoints", () => {
    const clientSource = readFileSync(join(packageRoot, "src", "lib", "client.ts"), "utf8")

    for (const prefix of retiredToolPrefixes) {
      expect(clientSource).not.toContain(prefix)
    }
  })

  test("does not advertise retired commands in shell completions", () => {
    const completionsSource = readFileSync(
      join(packageRoot, "src", "commands", "completions.ts"),
      "utf8",
    )

    for (const command of [...retiredCommandFamilies, "notify"]) {
      expect(completionsSource).not.toContain(`name: "${command}"`)
    }
  })
})
