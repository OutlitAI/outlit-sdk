import { describe, expect, spyOn, test } from "bun:test"
import {
  pollCliAuthRequest,
  startCliAuthRequest,
  waitForCliAuthApproval,
} from "../../src/lib/cli-auth"

describe("CLI browser auth client", () => {
  test("starts a CLI auth request against the platform API", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          requestId: "req_123",
          pollToken: "poll_token_123",
          userCode: "ABCD-1234",
          approveUrl: "https://app.outlit.ai/cli-auth?request=req_123",
          expiresAt: "2026-05-11T20:00:00.000Z",
          intervalSeconds: 2,
        }),
        { status: 200 },
      ),
    )

    const result = await startCliAuthRequest("https://app.outlit.ai")

    expect(result.requestId).toBe("req_123")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://app.outlit.ai/api/cli-auth/start")
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe("POST")

    fetchSpy.mockRestore()
  })

  test("polls a CLI auth request with the terminal-only poll token", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "pending", intervalSeconds: 2 }), { status: 200 }),
    )

    const result = await pollCliAuthRequest("https://app.outlit.ai", {
      requestId: "req_123",
      pollToken: "poll_token_123",
    })

    expect(result.status).toBe("pending")
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://app.outlit.ai/api/cli-auth/poll")
    const opts = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(opts.method).toBe("POST")
    expect(JSON.parse(opts.body as string)).toEqual({
      requestId: "req_123",
      pollToken: "poll_token_123",
    })

    fetchSpy.mockRestore()
  })

  test("parses a failed CLI auth poll response", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "failed", error: "Could not verify CLI key" }), {
        status: 200,
      }),
    )

    const result = await pollCliAuthRequest("https://app.outlit.ai", {
      requestId: "req_123",
      pollToken: "poll_token_123",
    })

    expect(result).toEqual({
      status: "failed",
      error: "Could not verify CLI key",
    })

    fetchSpy.mockRestore()
  })

  test("returns invalid CLI auth poll credentials without treating them as transient", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Invalid CLI auth polling credentials",
          status: "invalid",
        }),
        { status: 401 },
      ),
    )

    const result = await pollCliAuthRequest("https://app.outlit.ai", {
      requestId: "req_123",
      pollToken: "wrong_poll_token",
    })

    expect(result).toEqual({ status: "invalid" })

    fetchSpy.mockRestore()
  })

  test("waits until polling returns an approved API key", async () => {
    let callCount = 0
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async () => {
      callCount += 1
      return new Response(
        JSON.stringify(
          callCount === 1
            ? { status: "pending", intervalSeconds: 1 }
            : {
                status: "approved",
                apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
                keyPrefix: "ok_abc",
              },
        ),
        { status: 200 },
      )
    }) as unknown as typeof fetch)

    const result = await waitForCliAuthApproval(
      "https://app.outlit.ai",
      {
        requestId: "req_123",
        pollToken: "poll_token_123",
        intervalSeconds: 1,
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      },
      {
        intervalMs: 10,
        timeoutMs: 1_000,
      },
    )

    expect(result).toEqual({
      status: "approved",
      apiKey: "ok_abcdefghijklmnopqrstuvwxyz123456",
      keyPrefix: "ok_abc",
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    fetchSpy.mockRestore()
  })
})
