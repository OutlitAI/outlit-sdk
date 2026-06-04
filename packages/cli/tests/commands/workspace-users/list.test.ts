import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import {
  expectErrorExit,
  mockExitThrow,
  setInteractive,
  setNonInteractive,
  TEST_API_KEY,
  useTempEnv,
} from "../../helpers"

const mockCallTool = mock(async (_toolName: string, _params: unknown) => ({
  items: [
    {
      id: "user_csm",
      email: "kevin@nooks.ai",
      name: "Kevin Kim",
      role: "CSM",
      ownedCustomerCount: 7,
    },
  ],
  pagination: { hasMore: false, nextCursor: null, total: 1 },
}))

mock.module("../../../src/lib/client", () => ({
  createClient: async () => ({
    key: TEST_API_KEY,
    baseUrl: "https://app.outlit.ai",
    callTool: mockCallTool,
  }),
}))

setNonInteractive()

describe("workspace-users list", () => {
  useTempEnv("workspace-users-list-test")

  beforeEach(() => {
    mockCallTool.mockClear()
  })

  async function expectInvalidSortArgs(args: Record<string, unknown>) {
    const { default: listCmd } = await import("../../../src/commands/workspace-users/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await listCmd.run!({
        args: {
          ...args,
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "invalid_input")
      expect(mockCallTool).not.toHaveBeenCalled()
    }
  }

  test("maps list flags to outlit_list_workspace_users params", async () => {
    const { default: listCmd } = await import("../../../src/commands/workspace-users/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          search: "enterprise",
          role: "CSM",
          "manager-email": "sandy@nooks.ai",
          "has-owned-customers": true,
          "order-by": "owned_customer_count",
          "order-direction": "desc",
          limit: "25",
          cursor: "next-page-cursor",
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_workspace_users",
        expect.objectContaining({
          search: "enterprise",
          role: "CSM",
          managerEmail: "sandy@nooks.ai",
          hasOwnedCustomers: true,
          orderBy: "owned_customer_count",
          orderDirection: "desc",
          limit: 25,
          cursor: "next-page-cursor",
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("forwards explicit false for has-owned-customers", async () => {
    const { default: listCmd } = await import("../../../src/commands/workspace-users/list")
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await listCmd.run!({
        args: {
          "has-owned-customers": false,
          json: true,
        },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      expect(mockCallTool).toHaveBeenCalledWith(
        "outlit_list_workspace_users",
        expect.objectContaining({
          hasOwnedCustomers: false,
        }),
      )
    } finally {
      writeSpy.mockRestore()
    }
  })

  test("invalid order-by returns invalid_input before calling the tool", async () => {
    await expectInvalidSortArgs({ "order-by": "last_activity_at" })
  })

  test("invalid order-direction returns invalid_input before calling the tool", async () => {
    await expectInvalidSortArgs({
      "order-by": "owned_customer_count",
      "order-direction": "sideways",
    })
  })

  test("auth_required error on createClient failure", async () => {
    const clientModule = await import("../../../src/lib/client")
    const createClientSpy = spyOn(clientModule, "createClient").mockRejectedValue(
      new Error("No API key found. Run `outlit auth login` or set OUTLIT_API_KEY."),
    )
    const { default: listCmd } = await import("../../../src/commands/workspace-users/list")
    const exitSpy = mockExitThrow()
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    let thrown: unknown
    try {
      await listCmd.run!({
        args: { json: true },
      } as Parameters<NonNullable<typeof listCmd.run>>[0])
    } catch (e) {
      thrown = e
    } finally {
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("")
      createClientSpy.mockRestore()
      exitSpy.mockRestore()
      stderrSpy.mockRestore()

      expectErrorExit(thrown, stderrOutput, "auth_required")
    }
  })

  test("renders table with workspace user columns in interactive mode", async () => {
    setInteractive()
    const { default: listCmd } = await import("../../../src/commands/workspace-users/list")
    const logSpy = spyOn(console, "log").mockImplementation(() => {})
    try {
      await listCmd.run!({
        args: {},
      } as Parameters<NonNullable<typeof listCmd.run>>[0])

      const output = logSpy.mock.calls.map((c) => c[0] as string).join("\n")
      expect(output).toContain("Email")
      expect(output).toContain("Name")
      expect(output).toContain("Role")
      expect(output).toContain("Owned")
      expect(output).toContain("kevin@nooks.ai")
      expect(output).toContain("Kevin Kim")
    } finally {
      logSpy.mockRestore()
      setNonInteractive()
    }
  })
})
