import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { OutlitToolsApiError, type PublicToolResult } from "@outlit/tools"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const customerId = "10000000-0000-4000-8000-000000000000"
const targetUserId = "user_target_123"
const assignOwnerResponse = {
  customerId,
  ownerId: targetUserId,
  previousOwnerId: "user_previous_owner_123",
} satisfies PublicToolResult<"outlit_assign_customer_owner">
const grantAccessResponse = {
  access: {
    customerId,
    userId: targetUserId,
    role: "VIEWER",
    grantedById: "user_actor_123",
  },
} satisfies PublicToolResult<"outlit_grant_customer_access">
const changedAccessResponse = {
  access: {
    customerId,
    userId: targetUserId,
    role: "EDITOR",
    grantedById: "user_actor_123",
  },
} satisfies PublicToolResult<"outlit_grant_customer_access">
const revokeAccessResponse = {
  customerId,
  userId: targetUserId,
} satisfies PublicToolResult<"outlit_revoke_customer_access">

const mockCallTool = mock(async (toolName: string, _params: unknown): Promise<unknown> => {
  switch (toolName) {
    case "outlit_assign_customer_owner":
      return assignOwnerResponse
    case "outlit_grant_customer_access":
      return grantAccessResponse
    case "outlit_revoke_customer_access":
      return revokeAccessResponse
    default:
      throw new Error(`Unexpected tool call: ${toolName}`)
  }
})
const mockCreateClient = mock(async () => ({
  key: TEST_API_KEY,
  baseUrl: "https://app.outlit.ai",
  callTool: mockCallTool,
}))

mock.module("../../../src/lib/client", () => ({
  createClient: mockCreateClient,
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
  let stdoutOutput = ""
  try {
    await command.run?.({ args } as never)
  } finally {
    stdoutOutput = writeSpy.mock.calls.map((call) => call[0] as string).join("")
    writeSpy.mockRestore()
  }

  return stdoutOutput
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
  expect(mockCreateClient).not.toHaveBeenCalled()
  expect(mockCallTool).not.toHaveBeenCalled()
}

describe("customer collaboration commands", () => {
  useTempEnv("customer-collaboration-test")

  beforeEach(() => {
    mockCreateClient.mockClear()
    mockCallTool.mockClear()
  })

  test("owner set sends the canonical owner assignment payload", async () => {
    const stdout = await runCommand(import("../../../src/commands/customers/owner/set"), {
      "customer-id": customerId,
      "target-user-id": targetUserId,
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_assign_customer_owner", {
      customerId,
      targetUserId,
    })
    expect(stdout).toBe(`${JSON.stringify(assignOwnerResponse, null, 2)}\n`)
  })

  test("grant sends the canonical access grant payload", async () => {
    const stdout = await runCommand(import("../../../src/commands/customers/grant"), {
      "customer-id": customerId,
      "target-user-id": targetUserId,
      role: "VIEWER",
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_grant_customer_access", {
      customerId,
      targetUserId,
      role: "VIEWER",
    })
    expect(stdout).toBe(`${JSON.stringify(grantAccessResponse, null, 2)}\n`)
  })

  test("grant changes an existing collaborator by reusing the canonical upsert", async () => {
    mockCallTool.mockResolvedValueOnce(changedAccessResponse)
    const stdout = await runCommand(import("../../../src/commands/customers/grant"), {
      "customer-id": customerId,
      "target-user-id": targetUserId,
      role: "EDITOR",
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_grant_customer_access", {
      customerId,
      targetUserId,
      role: "EDITOR",
    })
    expect(stdout).toBe(`${JSON.stringify(changedAccessResponse, null, 2)}\n`)
  })

  test("revoke sends the canonical access revocation payload", async () => {
    const stdout = await runCommand(import("../../../src/commands/customers/revoke"), {
      "customer-id": customerId,
      "target-user-id": targetUserId,
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_revoke_customer_access", {
      customerId,
      targetUserId,
    })
    expect(stdout).toBe(`${JSON.stringify(revokeAccessResponse, null, 2)}\n`)
  })

  for (const [name, load] of [
    ["owner set", () => import("../../../src/commands/customers/owner/set")],
    ["grant", () => import("../../../src/commands/customers/grant")],
    ["revoke", () => import("../../../src/commands/customers/revoke")],
  ] as const) {
    test(`${name} rejects a non-UUID customer ID before any network call`, async () => {
      await expectLocalValidationError(load(), {
        "customer-id": "acme.com",
        "target-user-id": targetUserId,
        role: "VIEWER",
        json: true,
      })
    })

    test(`${name} rejects a whitespace-padded customer ID before any network call`, async () => {
      await expectLocalValidationError(load(), {
        "customer-id": ` ${customerId} `,
        "target-user-id": targetUserId,
        role: "VIEWER",
        json: true,
      })
    })
  }

  for (const [name, load] of [
    ["grant", () => import("../../../src/commands/customers/grant")],
  ] as const) {
    test(`${name} rejects OWNER before any network call`, async () => {
      await expectLocalValidationError(load(), {
        "customer-id": customerId,
        "target-user-id": targetUserId,
        role: "OWNER",
        json: true,
      })
    })

    test(`${name} rejects a lowercase role before any network call`, async () => {
      await expectLocalValidationError(
        load(),
        {
          "customer-id": customerId,
          "target-user-id": targetUserId,
          role: "viewer",
          json: true,
        },
        "invalid_input",
      )
    })

    test(`${name} rejects a whitespace-padded role before any network call`, async () => {
      await expectLocalValidationError(
        load(),
        {
          "customer-id": customerId,
          "target-user-id": targetUserId,
          role: " VIEWER ",
          json: true,
        },
        "invalid_input",
      )
    })
  }

  test("rejects a blank target user ID before any network call", async () => {
    await expectLocalValidationError(
      import("../../../src/commands/customers/owner/set"),
      {
        "customer-id": customerId,
        "target-user-id": "   ",
        json: true,
      },
      "missing_input",
    )
  })

  test("rejects an oversized target user ID before any network call", async () => {
    await expectLocalValidationError(import("../../../src/commands/customers/owner/set"), {
      "customer-id": customerId,
      "target-user-id": `${"u".repeat(500)} `,
      json: true,
    })
  })

  for (const [name, load] of [
    ["grant", () => import("../../../src/commands/customers/grant")],
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
    const command = (await import("../../../src/commands/customers/grant")).default
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
    const command = (await import("../../../src/commands/customers/revoke")).default
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
