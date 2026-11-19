import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { readCustomerSelector, requireCustomerSelector } from "../../src/args/customer"
import { ExitError, mockExitThrow, setNonInteractive } from "../helpers"

const acmeId = "10000000-0000-4000-8000-00000000000a"

async function expectExit(run: () => unknown): Promise<Record<string, unknown>> {
  const exitSpy = mockExitThrow()
  const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true)
  let thrown: unknown
  try {
    await run()
  } catch (error) {
    thrown = error
  } finally {
    exitSpy.mockRestore()
  }
  const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("")
  stderrSpy.mockRestore()
  expect(thrown).toBeInstanceOf(ExitError)
  expect((thrown as ExitError).code).toBe(1)
  return JSON.parse(stderr) as Record<string, unknown>
}

describe("customer selector", () => {
  beforeEach(() => setNonInteractive())
  afterEach(() => mock.restore())

  test("reads the positional, --customer, or --customer-id", () => {
    expect(readCustomerSelector({ customerPositional: " acme.com " }, true)).toBe("acme.com")
    expect(readCustomerSelector({ customer: "acme.com" }, true)).toBe("acme.com")
    expect(readCustomerSelector({ "customer-id": acmeId }, true)).toBe(acmeId)
    expect(
      readCustomerSelector({ customerPositional: "acme.com", customer: "acme.com" }, true),
    ).toBe("acme.com")
    expect(readCustomerSelector({}, true)).toBeUndefined()
  })

  test.each([
    [{ customer: "" }, "--customer"],
    [{ customerPositional: "   " }, "<customer>"],
    [{ "customer-id": " ", customer: "acme.com" }, "--customer-id"],
  ])("rejects a blank customer instead of dropping the filter: %j", async (args, source) => {
    const error = await expectExit(() => readCustomerSelector(args, true))

    expect(error).toEqual({
      error: `${source} needs a customer domain, name, or ID`,
      code: "invalid_input",
    })
  })

  test("rejects two different customers", async () => {
    const error = await expectExit(() =>
      readCustomerSelector({ customerPositional: "acme.com", customer: "beta.com" }, true),
    )

    expect(error.code).toBe("invalid_input")
    expect(error.error).toBe("Give one customer; got <customer> acme.com and --customer beta.com")
  })

  test("requires a customer where the command needs one", async () => {
    const error = await expectExit(() => requireCustomerSelector({}, "outlit timeline get", true))

    expect(error.code).toBe("missing_input")
    expect(error.error).toContain("outlit timeline get --customer <domain|name|id>")
  })
})
