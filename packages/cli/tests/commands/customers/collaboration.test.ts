import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { OutlitToolsApiError, type PublicToolResult } from "@outlit/tools"
import {
  expectErrorExit,
  mockExitThrow,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const customer = "acme.com"
const customerRef = { id: "10000000-0000-4000-8000-000000000000", name: "Acme", domain: "acme.com" }
const member = "user_target_123"
const memberRef = { id: member, name: "Target User", email: "target@example.com" }
const previousOwner = { id: "user_previous_owner_123", name: "Previous", email: "prev@example.com" }

const ownerPreview = {
  outcome: "previewed",
  customer: customerRef,
  owner: previousOwner,
  newOwner: memberRef,
  previousOwnerRole: null,
  undo: { available: true },
  preview: { token: "owner_preview_token", expiresAt: "2026-07-28T00:15:00.000Z" },
  next: { instruction: "Nothing was changed; to do it, call again with this input" },
} satisfies PublicToolResult<"outlit_set_customer_owner">
const ownerChanged = {
  outcome: "changed",
  customer: customerRef,
  owner: memberRef,
  previousOwner,
  previousOwnerRole: "editor",
  undo: { token: "owner_undo_token", until: "2026-07-29T00:00:00.000Z" },
} satisfies PublicToolResult<"outlit_set_customer_owner">
const accessChanged = {
  outcome: "changed",
  customer: customerRef,
  member: memberRef,
  role: "viewer",
  previousRole: "none",
  undo: { token: "access_undo_token", until: "2026-07-29T00:00:00.000Z" },
} satisfies PublicToolResult<"outlit_set_customer_access">
const accessNeedsConfirmation = {
  outcome: "needs_confirmation",
  customer: customerRef,
  member: memberRef,
  role: "none",
  previousRole: "editor",
  reason: "This removes your own access, and you could not give it back.",
  preview: { token: "access_preview_token", expiresAt: "2026-07-28T00:15:00.000Z" },
  next: { instruction: "Nothing was changed; to do it, call again with this input" },
} satisfies PublicToolResult<"outlit_set_customer_access">

const mockCallTool = mock(async (toolName: string, _params: unknown): Promise<unknown> => {
  switch (toolName) {
    case "outlit_set_customer_owner":
      return ownerPreview
    case "outlit_set_customer_access":
      return accessChanged
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
    mockCallTool.mockImplementation(async (toolName: string) => {
      if (toolName === "outlit_set_customer_owner") return ownerPreview
      if (toolName === "outlit_set_customer_access") return accessChanged
      throw new Error(`Unexpected tool call: ${toolName}`)
    })
  })

  test("owner set previews first, then confirms with the preview token under --yes", async () => {
    mockCallTool.mockResolvedValueOnce(ownerPreview)
    mockCallTool.mockResolvedValueOnce(ownerChanged)
    const stdout = await runCommand(import("../../../src/commands/customers/owner/set"), {
      customer,
      member,
      yes: true,
      json: true,
    })

    expect(mockCallTool).toHaveBeenNthCalledWith(1, "outlit_set_customer_owner", {
      customer,
      member,
      requestId: expect.any(String),
    })
    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_set_customer_owner", {
      customer,
      member,
      mode: "execute",
      previewToken: "owner_preview_token",
      requestId: expect.any(String),
    })
    expect(stdout).toBe(`${JSON.stringify(ownerChanged, null, 2)}\n`)
  })

  test("owner set sends two different request IDs, one per call", async () => {
    mockCallTool.mockResolvedValueOnce(ownerPreview)
    mockCallTool.mockResolvedValueOnce(ownerChanged)
    await runCommand(import("../../../src/commands/customers/owner/set"), {
      customer,
      member,
      yes: true,
      json: true,
    })

    const ids = mockCallTool.mock.calls.map((call) => (call[1] as { requestId: string }).requestId)
    expect(new Set(ids).size).toBe(2)
  })

  test("owner set without --yes outside a terminal changes nothing and exits with the preview", async () => {
    const command = (await import("../../../src/commands/customers/owner/set")).default
    const exitSpy = mockExitThrow()
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    let thrown: unknown
    let stdoutOutput = ""
    let stderrOutput = ""
    try {
      await command.run?.({ args: { customer, member, json: true } } as never)
    } catch (error) {
      thrown = error
    } finally {
      stdoutOutput = stdoutSpy.mock.calls.map((call) => call[0] as string).join("")
      stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrOutput, "confirmation_required")
    expect(JSON.parse(stdoutOutput)).toEqual(ownerPreview)
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("grant sends the access write in one call and reads the old spellings", async () => {
    const stdout = await runCommand(import("../../../src/commands/customers/grant"), {
      customer,
      "target-user-id": member,
      role: "VIEWER",
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledTimes(1)
    expect(mockCallTool).toHaveBeenCalledWith("outlit_set_customer_access", {
      customer,
      member,
      role: "viewer",
      requestId: expect.any(String),
    })
    expect(stdout).toBe(`${JSON.stringify(accessChanged, null, 2)}\n`)
  })

  test("grant changes an existing collaborator's role through the same write", async () => {
    await runCommand(import("../../../src/commands/customers/grant"), {
      customer,
      member,
      role: "editor",
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_set_customer_access", {
      customer,
      member,
      role: "editor",
      requestId: expect.any(String),
    })
  })

  test("revoke is a write of role none", async () => {
    const stdout = await runCommand(import("../../../src/commands/customers/revoke"), {
      customer,
      member,
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith("outlit_set_customer_access", {
      customer,
      member,
      role: "none",
      requestId: expect.any(String),
    })
    expect(stdout).toBe(`${JSON.stringify(accessChanged, null, 2)}\n`)
  })

  test("revoke asks to be confirmed when Core says the caller could not undo it", async () => {
    mockCallTool.mockResolvedValueOnce(accessNeedsConfirmation)
    mockCallTool.mockResolvedValueOnce({ ...accessChanged, role: "none", undo: null })
    await runCommand(import("../../../src/commands/customers/revoke"), {
      customer,
      member,
      yes: true,
      json: true,
    })

    expect(mockCallTool).toHaveBeenNthCalledWith(2, "outlit_set_customer_access", {
      customer,
      member,
      role: "none",
      mode: "execute",
      previewToken: "access_preview_token",
      requestId: expect.any(String),
    })
  })

  test("a needs_confirmation answer without --yes outside a terminal changes nothing", async () => {
    mockCallTool.mockResolvedValueOnce(accessNeedsConfirmation)
    const command = (await import("../../../src/commands/customers/revoke")).default
    const exitSpy = mockExitThrow()
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
    let thrown: unknown
    let stderrOutput = ""
    try {
      await command.run?.({ args: { customer, member, json: true } } as never)
    } catch (error) {
      thrown = error
    } finally {
      stderrOutput = stderrSpy.mock.calls.map((call) => call[0] as string).join("")
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }

    expectErrorExit(thrown, stderrOutput, "confirmation_required")
    expect(mockCallTool).toHaveBeenCalledTimes(1)
  })

  test("takes a customer by id, domain or name", async () => {
    await runCommand(import("../../../src/commands/customers/grant"), {
      customer: "Acme Inc",
      member,
      role: "viewer",
      json: true,
    })

    expect(mockCallTool).toHaveBeenCalledWith(
      "outlit_set_customer_access",
      expect.objectContaining({ customer: "Acme Inc" }),
    )
  })

  test("grant rejects OWNER and NONE before any network call", async () => {
    for (const role of ["OWNER", "none"]) {
      await expectLocalValidationError(import("../../../src/commands/customers/grant"), {
        customer,
        member,
        role,
        json: true,
      })
      mockCallTool.mockClear()
      mockCreateClient.mockClear()
    }
  })

  test("grant rejects a missing role before any network call", async () => {
    await expectLocalValidationError(
      import("../../../src/commands/customers/grant"),
      { customer, member, json: true },
      "missing_input",
    )
  })

  test("rejects a blank member before any network call", async () => {
    await expectLocalValidationError(
      import("../../../src/commands/customers/owner/set"),
      { customer, member: "   ", json: true },
      "missing_input",
    )
  })

  test("rejects an oversized member before any network call", async () => {
    await expectLocalValidationError(import("../../../src/commands/customers/owner/set"), {
      customer,
      member: `${"u".repeat(501)} `,
      json: true,
    })
  })

  test("rejects a blank customer before any network call", async () => {
    await expectLocalValidationError(
      import("../../../src/commands/customers/revoke"),
      { customer: "  ", member, json: true },
      "missing_input",
    )
  })

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
          customer,
          member,
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
          customer,
          member,
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
