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

const activation = {
  eventName: EVENT_NAME,
} as const

const getResponse = {
  activation,
}

const previewResponse = {
  preview: {
    eventName: EVENT_NAME,
    evaluatedFrom: "2026-06-28T00:00:00.000Z",
    evaluatedTo: "2026-07-28T00:00:00.000Z",
    evaluatedEventCount: 40,
    matchedCustomerCount: 12,
    alreadyActivatedCustomerCount: 9,
    wouldActivateCustomerCount: 3,
    evaluatedContactOccurrenceCount: 44,
    matchedContactCount: 18,
    alreadyActivatedContactCount: 11,
    wouldActivateContactCount: 7,
    contactTruncated: false,
    customerTruncated: false,
    truncated: false,
    examples: [
      {
        customer: { id: "customer_123", name: "Acme", domain: "acme.com" },
        activatedAt: null,
        firstMatchedAt: "2026-07-20T12:00:00.000Z",
        eventId: "10000000-0000-4000-8000-000000000001",
      },
    ],
  },
}

const updateResponse = {
  activation,
  changed: true,
}

const mockCallTool = mock(async (toolName: string, _params: unknown) => {
  if (toolName === "outlit_preview_customer_activation") return previewResponse
  if (toolName === "outlit_update_customer_activation") return updateResponse
  return getResponse
})

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
    mockCallTool.mockImplementation(async (toolName: string) => {
      if (toolName === "outlit_preview_customer_activation") return previewResponse
      if (toolName === "outlit_update_customer_activation") return updateResponse
      return getResponse
    })
  })

  test("keeps authored activation commands bound to catalog tool names", async () => {
    const commands = [
      ["get.ts", "outlit_get_customer_activation"],
      ["preview.ts", "outlit_preview_customer_activation"],
      ["update.ts", "outlit_update_customer_activation"],
      ["disable.ts", "outlit_update_customer_activation"],
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

    expect(mockCallTool).toHaveBeenCalledWith("outlit_get_customer_activation", {})
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
    expect(mockCallTool).toHaveBeenCalledWith("outlit_preview_customer_activation", {
      eventName: EVENT_NAME,
      lookbackDays: 45,
      exampleLimit: 12,
    })
    expect(mockCallTool).not.toHaveBeenCalledWith(
      "outlit_update_customer_activation",
      expect.anything(),
    )
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

    expect(mockCallTool).toHaveBeenCalledWith("outlit_preview_customer_activation", {
      eventName: EVENT_NAME,
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

    expect(mockCallTool).toHaveBeenCalledWith("outlit_update_customer_activation", {
      eventName: EVENT_NAME,
    })
  })

  test("disable explicitly sends a null event name", async () => {
    const { default: disableCommand } = await import("../../src/commands/activation/disable")

    await captureStdout(async () => {
      await disableCommand.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof disableCommand.run>>[0])
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_update_customer_activation", {
      eventName: null,
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
          ToolOutput_outlit_preview_customer_activation: {
            properties: {
              preview: {
                required: string[]
                properties: Record<string, unknown>
              }
            }
          }
        }
      }
    }
    const schema =
      openApi.components.schemas.ToolOutput_outlit_preview_customer_activation.properties.preview

    expect(schema.required).toEqual(
      expect.arrayContaining([
        "evaluatedContactOccurrenceCount",
        "matchedContactCount",
        "alreadyActivatedContactCount",
        "wouldActivateContactCount",
        "contactTruncated",
        "customerTruncated",
      ]),
    )
    expect(schema.properties).toMatchObject({
      evaluatedContactOccurrenceCount: { type: "integer", minimum: 0 },
      matchedContactCount: { type: "integer", minimum: 0 },
      alreadyActivatedContactCount: { type: "integer", minimum: 0 },
      wouldActivateContactCount: { type: "integer", minimum: 0 },
      contactTruncated: { type: "boolean" },
      customerTruncated: { type: "boolean" },
    })
  })
})
