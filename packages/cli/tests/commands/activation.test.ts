import { beforeEach, describe, expect, mock, test } from "bun:test"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { runCommand } from "citty"
import { captureStdout, setNonInteractive, TEST_API_KEY, useTempEnv } from "../helpers"

const EVENT_NAME = "integration_connected"
const activationSection = {
  status: "available",
  asOf: "2026-07-28T00:00:00.000Z",
  data: { event: EVENT_NAME },
} as const

const settingsResponse = {
  settings: {
    general: {
      status: "available",
      asOf: "2026-07-28T00:00:00.000Z",
      data: { timezone: "America/Los_Angeles", defaultOwner: null },
    },
    activation: activationSection,
  },
  revision: "settings_revision_1",
}

const previewResponse = {
  event: EVENT_NAME,
  window: { from: "2026-06-28T00:00:00.000Z", to: "2026-07-28T00:00:00.000Z" },
  evaluatedEvents: 40,
  customers: { matched: 12, alreadyActivated: 9, wouldActivate: 3, truncated: false },
  contacts: {
    matched: 18,
    alreadyActivated: 11,
    wouldActivate: 7,
    truncated: false,
    occurrences: 44,
  },
  examples: [
    {
      customer: { id: "customer_123", name: "Acme", domain: "acme.com" },
      activatedAt: null,
      firstMatchedAt: "2026-07-20T12:00:00.000Z",
      eventId: "10000000-0000-4000-8000-000000000001",
    },
  ],
}

const updateResponse = {
  settings: settingsResponse.settings,
  revision: "settings_revision_2",
  changed: ["activationEvent"],
}

function respond(toolName: string) {
  if (toolName === "outlit_preview_activation") return previewResponse
  if (toolName === "outlit_update_settings") return updateResponse
  return settingsResponse
}

const mockCallTool = mock(async (toolName: string, _params: unknown) => respond(toolName))

mock.module("../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

describe("activation commands", () => {
  useTempEnv("activation-test")

  beforeEach(() => {
    setNonInteractive()
    mockCallTool.mockClear()
    mockCallTool.mockImplementation(async (toolName: string) => respond(toolName))
  })

  test("uses the conventional activation resource vocabulary", async () => {
    const { default: activationCommand } = await import("../../src/commands/activation")

    expect(Object.keys(activationCommand.subCommands ?? {})).toEqual(["preview"])
  })

  test("preview sends one event name through the read-only operation", async () => {
    const { default: previewCommand } = await import("../../src/commands/activation/preview")

    const result = await captureStdout(async () => {
      await previewCommand.run!({
        args: {
          event: ` ${EVENT_NAME} `,
          "lookback-days": "45",
          "example-limit": "12",
          json: true,
        },
      } as Parameters<NonNullable<typeof previewCommand.run>>[0])
    })

    expect(mockCallTool).toHaveBeenCalledTimes(1)
    expect(mockCallTool).toHaveBeenCalledWith("outlit_preview_activation", {
      event: EVENT_NAME,
      lookbackDays: 45,
      exampleLimit: 12,
    })
    expect(mockCallTool).not.toHaveBeenCalledWith("outlit_update_settings", expect.anything())
    expect(result).toEqual(previewResponse)
  })

  test("citty parses preview flags into Core's typed request", async () => {
    const { default: previewCommand } = await import("../../src/commands/activation/preview")

    await captureStdout(async () => {
      await runCommand(previewCommand, {
        rawArgs: [
          "--event",
          EVENT_NAME,
          "--lookback-days",
          "90",
          "--example-limit",
          "20",
          "--json",
        ],
      })
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_preview_activation", {
      event: EVENT_NAME,
      lookbackDays: 90,
      exampleLimit: 20,
    })
  })

  test("all command help describes the shared contact and company setting", async () => {
    const commands = await Promise.all([
      import("../../src/commands/activation/preview").then((module) => module.default),
    ])
    const descriptions: string[] = []

    for (const command of commands) {
      const metaSource = command.meta
      const meta =
        typeof metaSource === "function" ? await metaSource() : await Promise.resolve(metaSource)
      const description = meta?.description ?? ""
      descriptions.push(description)

      expect(description.toLowerCase()).toContain("contact")
      expect(description.toLowerCase()).toContain("compan")
    }

    const previewDescription = descriptions[0]
    expect(previewDescription).toContain("separate impact counts")
    expect(previewDescription).toContain("read-only")
  })

  test("documents bounded people and company preview totals in OpenAPI", async () => {
    const openApi = JSON.parse(
      await readFile(path.resolve(import.meta.dir, "../../../../docs/openapi.json"), "utf8"),
    ) as {
      components: {
        schemas: {
          ToolOutput_outlit_preview_activation: {
            properties: {
              customers: { required: string[]; properties: Record<string, unknown> }
              contacts: { required: string[]; properties: Record<string, unknown> }
            }
          }
        }
      }
    }
    const { customers, contacts } =
      openApi.components.schemas.ToolOutput_outlit_preview_activation.properties

    expect(customers.required).toEqual(
      expect.arrayContaining(["matched", "alreadyActivated", "wouldActivate", "truncated"]),
    )
    expect(contacts.required).toEqual(
      expect.arrayContaining([
        "matched",
        "alreadyActivated",
        "wouldActivate",
        "truncated",
        "occurrences",
      ]),
    )
    expect(contacts.properties).toMatchObject({
      matched: { type: "integer", minimum: 0 },
      alreadyActivated: { type: "integer", minimum: 0 },
      wouldActivate: { type: "integer", minimum: 0 },
      occurrences: { type: "integer", minimum: 0 },
      truncated: { type: "boolean" },
    })
  })
})
