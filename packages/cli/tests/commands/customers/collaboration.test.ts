import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { OutlitToolsApiError } from "@outlit/tools"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const customerId = "10000000-0000-4000-8000-000000000000"
const targetUserId = "user_target_123"

const mockCallTool = mock(
  async (_toolName: string, _params: unknown): Promise<unknown> => ({
    customerId,
    userId: targetUserId,
  }),
)

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

async function loadCommand(module: Promise<unknown>) {
  return (await module) as {
    default: { run?: (context: never) => Promise<unknown> | unknown }
  }
}

async function runCommand(module: Promise<unknown>, args: Record<string, unknown>) {
  const command = (await loadCommand(module)).default
  const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
  try {
    await command.run?.({ args } as never)
  } finally {
    writeSpy.mockRestore()
  }
}

async function expectLocalValidationError(
  module: Promise<unknown>,
  args: Record<string, unknown>,
  expectedCode = "invalid_input",
) {
  const command = (await loadCommand(module)).default
  const exitSpy = mockExitThrow()
  const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

  let thrown: unknown
  let stderrOutput = ""
  try {
    await command.run?.({ args } as never)
  } catch (error) {
    thrown = error
  } finally {
    stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
    stderrSpy.mockRestore()
    exitSpy.mockRestore()
  }

  expectErrorExit(thrown, stderrOutput, expectedCode)
  expect(mockCallTool).not.toHaveBeenCalled()
}

describe("customer collaboration commands", () => {
  useTempEnv("customer-collaboration-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  test("assign-owner sends the canonical owner assignment payload", async () => {
    await runCommand(import("../../../src/commands/customers/assign-owner"), {
      "customer-id": customerId,
      "target-user-id": targetUserId,
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_assign_customer_owner", {
      customerId,
      targetUserId,
    })
  })

  test("grant-access sends the canonical access grant payload", async () => {
    await runCommand(import("../../../src/commands/customers/grant-access"), {
      "customer-id": customerId,
      "target-user-id": targetUserId,
      role: "viewer",
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_grant_customer_access", {
      customerId,
      targetUserId,
      role: "VIEWER",
    })
  })

  test("update-access sends the canonical access update payload", async () => {
    await runCommand(import("../../../src/commands/customers/update-access"), {
      "customer-id": customerId,
      "target-user-id": targetUserId,
      role: "EDITOR",
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_update_customer_access", {
      customerId,
      targetUserId,
      role: "EDITOR",
    })
  })

  test("revoke-access sends the canonical access revocation payload", async () => {
    await runCommand(import("../../../src/commands/customers/revoke-access"), {
      "customer-id": customerId,
      "target-user-id": targetUserId,
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_revoke_customer_access", {
      customerId,
      targetUserId,
    })
  })

  for (const [name, load] of [
    ["assign-owner", () => import("../../../src/commands/customers/assign-owner")],
    ["grant-access", () => import("../../../src/commands/customers/grant-access")],
    ["update-access", () => import("../../../src/commands/customers/update-access")],
    ["revoke-access", () => import("../../../src/commands/customers/revoke-access")],
  ] as const) {
    test(`${name} rejects a non-UUID customer ID before any network call`, async () => {
      await expectLocalValidationError(load(), {
        "customer-id": "acme.com",
        "target-user-id": targetUserId,
        role: "VIEWER",
        json: true,
      })
    })
  }

  for (const [name, load] of [
    ["grant-access", () => import("../../../src/commands/customers/grant-access")],
    ["update-access", () => import("../../../src/commands/customers/update-access")],
  ] as const) {
    test(`${name} rejects OWNER before any network call`, async () => {
      await expectLocalValidationError(load(), {
        "customer-id": customerId,
        "target-user-id": targetUserId,
        role: "OWNER",
        json: true,
      })
    })
  }

  test("rejects a blank target user ID before any network call", async () => {
    await expectLocalValidationError(
      import("../../../src/commands/customers/assign-owner"),
      {
        "customer-id": customerId,
        "target-user-id": "   ",
        json: true,
      },
      "missing_input",
    )
  })

  test("rejects an oversized target user ID before any network call", async () => {
    await expectLocalValidationError(import("../../../src/commands/customers/assign-owner"), {
      "customer-id": customerId,
      "target-user-id": "u".repeat(501),
      json: true,
    })
  })

  for (const [name, load] of [
    ["grant-access", () => import("../../../src/commands/customers/grant-access")],
    ["update-access", () => import("../../../src/commands/customers/update-access")],
  ] as const) {
    test(`${name} rejects a missing role before any network call`, async () => {
      await expectLocalValidationError(
        load(),
        {
          "customer-id": customerId,
          "target-user-id": targetUserId,
          json: true,
        },
        "missing_input",
      )
    })
  }

  test("preserves Core's structured permission error envelope", async () => {
    const envelope = {
      code: "TOOL_CALL_FORBIDDEN" as const,
      message: "Tool call is not authorized",
      retryable: false,
      requestId: "request_permission_123",
    }
    mockCallTool.mockRejectedValueOnce(
      new OutlitToolsApiError(403, JSON.stringify(envelope), envelope),
    )
    const command = (await import("../../../src/commands/customers/grant-access")).default
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()
    let thrown: unknown
    let stderrOutput = ""
    try {
      await command.run?.({
        args: {
          "customer-id": customerId,
          "target-user-id": targetUserId,
          role: "VIEWER",
          json: true,
        },
      } as Parameters<NonNullable<typeof command.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expect(thrown).toBeDefined()
    expect(JSON.parse(stderrOutput)).toEqual(envelope)
  })

  test("preserves Core's structured conflict error envelope", async () => {
    const envelope = {
      code: "TOOL_IMPLEMENTATION_ERROR" as const,
      message: "Tool implementation failed",
      retryable: false,
      requestId: "request_conflict_123",
    }
    mockCallTool.mockRejectedValueOnce(
      new OutlitToolsApiError(409, JSON.stringify(envelope), envelope),
    )
    const command = (await import("../../../src/commands/customers/revoke-access")).default
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitSpy = mockExitThrow()
    let thrown: unknown
    let stderrOutput = ""
    try {
      await command.run?.({
        args: {
          "customer-id": customerId,
          "target-user-id": targetUserId,
          json: true,
        },
      } as Parameters<NonNullable<typeof command.run>>[0])
    } catch (error) {
      thrown = error
    } finally {
      stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expect(thrown).toBeDefined()
    expect(JSON.parse(stderrOutput)).toEqual(envelope)
  })
})
