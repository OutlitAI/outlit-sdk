import { beforeEach, describe, expect, mock, test } from "bun:test"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { runCommand } from "citty"
import {
  captureStdout,
  runExpectingError,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../helpers"

const EVENT_NAME = "integration_connected"
const activationCommandPath = (fileName: string) =>
  path.resolve(import.meta.dir, "../../src/commands/activation", fileName)

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

// What `activation get` prints: the activation part of the settings read.
const getResponse = {
  activation: activationSection,
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

  test("keeps authored activation commands bound to catalog tool names", async () => {
    const commands = [
      ["get.ts", "outlit_get_settings"],
      ["preview.ts", "outlit_preview_activation"],
      ["update.ts", "outlit_update_settings"],
      ["disable.ts", "outlit_update_settings"],
    ] as const

    for (const [fileName, toolName] of commands) {
      const source = await readFile(activationCommandPath(fileName), "utf8")

      expect(source).toContain(`runTool(client, "${toolName}"`)
    }
  })

  test("uses the conventional activation resource vocabulary", async () => {
    const { default: activationCommand } = await import("../../src/commands/activation")

    expect(Object.keys(activationCommand.subCommands ?? {})).toEqual([
      "get",
      "preview",
      "update",
      "disable",
    ])
  })

  test("get returns the catalog-projected activation result", async () => {
    const { default: getCommand } = await import("../../src/commands/activation/get")

    const result = await captureStdout(async () => {
      await getCommand.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof getCommand.run>>[0])
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_settings", {})
    expect(result).toEqual(getResponse)
  })

  test("interactive output preserves the same activation result", async () => {
    const { default: getCommand } = await import("../../src/commands/activation/get")
    setInteractive()

    try {
      const result = await captureStdout(async () => {
        await getCommand.run!({
          args: {},
        } as Parameters<NonNullable<typeof getCommand.run>>[0])
      })

      expect(result).toEqual(getResponse)
    } finally {
      setNonInteractive()
    }
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

  test("update sends one exact event name", async () => {
    const { default: updateCommand } = await import("../../src/commands/activation/update")

    await captureStdout(async () => {
      await updateCommand.run!({
        args: {
          event: EVENT_NAME,
          json: true,
        },
      } as Parameters<NonNullable<typeof updateCommand.run>>[0])
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_update_settings", {
      activationEvent: EVENT_NAME,
    })
  })

  test("disable explicitly sends a null event name", async () => {
    const { default: disableCommand } = await import("../../src/commands/activation/disable")

    await captureStdout(async () => {
      await disableCommand.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof disableCommand.run>>[0])
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_update_settings", {
      activationEvent: null,
    })
  })

  test("invalid update input exits before any API mutation", async () => {
    const { default: updateCommand } = await import("../../src/commands/activation/update")

    await runExpectingError(async () => {
      await updateCommand.run!({
        args: { event: "e".repeat(192), json: true },
      } as Parameters<NonNullable<typeof updateCommand.run>>[0])
    }, "invalid_input")

    expect(mockCallTool).not.toHaveBeenCalled()
  })

  test("API failures retain the existing api_error envelope and exit code", async () => {
    mockCallTool.mockImplementationOnce(async () => {
      throw new Error("API error (503): unavailable")
    })
    const { default: getCommand } = await import("../../src/commands/activation/get")

    await runExpectingError(async () => {
      await getCommand.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof getCommand.run>>[0])
    }, "api_error")
  })

  test("all command help describes the shared contact and company setting", async () => {
    const commands = await Promise.all([
      import("../../src/commands/activation/get").then((module) => module.default),
      import("../../src/commands/activation/preview").then((module) => module.default),
      import("../../src/commands/activation/update").then((module) => module.default),
      import("../../src/commands/activation/disable").then((module) => module.default),
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

    const updateDescription = descriptions[2]
    expect(updateDescription).toContain("Core")
    expect(updateDescription).toContain("monotonic")
    expect(updateDescription).toContain("product event")

    const previewDescription = descriptions[1]
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
