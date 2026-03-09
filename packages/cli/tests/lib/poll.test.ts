import { describe, expect, mock, test } from "bun:test"
import { pollUntil } from "../../src/lib/poll"

describe("pollUntil", () => {
  test("returns immediately when predicate is true on first call", async () => {
    const fn = mock(async () => ({ status: "done" }))

    const result = await pollUntil(fn, (r) => r.status === "done", {
      intervalMs: 10,
      timeoutMs: 1000,
    })

    expect(result).toEqual({ status: "done" })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test("polls until predicate becomes true", async () => {
    let callCount = 0
    const fn = mock(async () => {
      callCount++
      return { status: callCount >= 3 ? "done" : "pending" }
    })

    const result = await pollUntil(fn, (r) => r.status === "done", {
      intervalMs: 10,
      timeoutMs: 5000,
    })

    expect(result).toEqual({ status: "done" })
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  test("returns null on timeout", async () => {
    const fn = mock(async () => ({ status: "pending" }))

    const result = await pollUntil(fn, (r) => r.status === "done", {
      intervalMs: 10,
      timeoutMs: 50,
    })

    expect(result).toBeNull()
  })

  test("updates spinner with elapsed time", async () => {
    let callCount = 0
    const fn = mock(async () => {
      callCount++
      return { status: callCount >= 2 ? "done" : "pending" }
    })
    const updateFn = mock((_msg: string) => {})
    const spinner = { update: updateFn, stop: mock(() => {}), fail: mock(() => {}) }

    await pollUntil(fn, (r) => r.status === "done", {
      intervalMs: 10,
      timeoutMs: 5000,
      spinner: spinner as never,
      spinnerMessage: "Waiting...",
    })

    expect(updateFn).toHaveBeenCalled()
    const msg = updateFn.mock.calls[0]?.[0] as string
    expect(msg).toMatch(/Waiting\.\.\. \(\d+s\)/)
  })

  test("swallows transient errors and continues polling", async () => {
    let callCount = 0
    const fn = mock(async () => {
      callCount++
      if (callCount <= 2) throw new Error("network error")
      return { status: "done" }
    })

    const result = await pollUntil(fn, (r) => r.status === "done", {
      intervalMs: 10,
      timeoutMs: 5000,
    })

    expect(result).toEqual({ status: "done" })
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  test("returns null on timeout even if all calls throw", async () => {
    const fn = mock(async () => {
      throw new Error("persistent failure")
    })

    const result = await pollUntil(fn, () => true, {
      intervalMs: 10,
      timeoutMs: 50,
    })

    expect(result).toBeNull()
  })

  test("uses default options when none provided", async () => {
    const fn = mock(async () => ({ ready: true }))

    const result = await pollUntil(fn, (r) => r.ready)

    expect(result).toEqual({ ready: true })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
