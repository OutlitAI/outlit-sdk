import type { TrackerEvent } from "@outlit/core"
import { describe, expect, it, vi } from "vitest"
import { EventQueue } from "../queue"

function event(name: string): TrackerEvent {
  return { type: "custom", eventName: name } as unknown as TrackerEvent
}

function names(events: TrackerEvent[]): string[] {
  return events.map((item) => (item as unknown as { eventName: string }).eventName)
}

/** An onFlush whose sends finish only when the test releases them. */
function controlledSend() {
  const batches: string[][] = []
  const pending: Array<{ resolve: () => void; reject: (error: unknown) => void }> = []
  const onFlush = vi.fn(
    (events: TrackerEvent[]) =>
      new Promise<void>((resolve, reject) => {
        batches.push(names(events))
        pending.push({ resolve, reject })
      }),
  )
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
  return { batches, pending, onFlush, settle }
}

describe("EventQueue.flush", () => {
  it("a second concurrent flush resolves only after its own event is sent", async () => {
    const send = controlledSend()
    const queue = new EventQueue({ onFlush: send.onFlush })

    queue.enqueue(event("first"))
    const first = queue.flush()
    queue.enqueue(event("second"))
    let secondDone = false
    const second = queue.flush().then(() => {
      secondDone = true
    })

    await send.settle()
    expect(send.batches).toEqual([["first"]])
    send.pending[0]?.resolve()
    await first
    await send.settle()

    expect(send.batches).toEqual([["first"], ["second"]])
    expect(secondDone).toBe(false)
    send.pending[1]?.resolve()
    await second
    expect(secondDone).toBe(true)
    expect(queue.size).toBe(0)
  })

  it("sends an event queued during an in-flight flush on the next awaited flush", async () => {
    const send = controlledSend()
    const queue = new EventQueue({ onFlush: send.onFlush })

    queue.enqueue(event("first"))
    const first = queue.flush()
    queue.enqueue(event("during"))
    send.pending[0]?.resolve()
    await first
    expect(queue.size).toBe(1)

    const next = queue.flush()
    await send.settle()
    send.pending[1]?.resolve()
    await next

    expect(send.batches).toEqual([["first"], ["during"]])
    expect(queue.size).toBe(0)
    expect(queue.flushing).toBe(false)
  })

  it("re-queues on a retryable failure, rethrows, and does not retry within the call", async () => {
    const failure = new Error("network down")
    const onFlush = vi.fn().mockRejectedValue(failure)
    const queue = new EventQueue({ onFlush })

    queue.enqueue(event("first"))
    await expect(queue.flush()).rejects.toBe(failure)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(queue.size).toBe(1)
  })

  it("drops events on a non-retryable failure", async () => {
    const failure = Object.assign(new Error("bad key"), { retryable: false })
    const queue = new EventQueue({ onFlush: vi.fn().mockRejectedValue(failure) })

    queue.enqueue(event("first"))
    await expect(queue.flush()).rejects.toBe(failure)

    expect(queue.size).toBe(0)
  })

  it("a waiting flush rethrows a non-retryable failure instead of resolving", async () => {
    const send = controlledSend()
    const queue = new EventQueue({ onFlush: send.onFlush })
    const failure = Object.assign(new Error("HTTP 401"), { retryable: false })

    queue.enqueue(event("first"))
    const failing = queue.flush()
    queue.enqueue(event("second"))
    const waiting = queue.flush()
    await send.settle()
    send.pending[0]?.reject(failure)

    await expect(failing).rejects.toBe(failure)
    await expect(waiting).rejects.toBe(failure)
    expect(send.batches).toEqual([["first"]])
  })

  it("a batch-size trigger does not wait behind, or resend after, an in-flight flush", async () => {
    const send = controlledSend()
    const queue = new EventQueue({ maxSize: 1, onFlush: send.onFlush })

    const first = queue.enqueue(event("first")).catch((error: unknown) => error)
    await queue.enqueue(event("second"))
    await queue.enqueue(event("third"))
    expect(send.batches).toEqual([["first"]])

    send.pending[0]?.reject(new Error("timeout"))
    expect(await first).toEqual(new Error("timeout"))
    await send.settle()

    expect(send.batches).toEqual([["first"]])
    expect(queue.size).toBe(3)
  })

  it("a waiting flush resends the events another caller's failed flush put back", async () => {
    const send = controlledSend()
    const queue = new EventQueue({ onFlush: send.onFlush })

    queue.enqueue(event("first"))
    const failing = queue.flush()
    const waiting = queue.flush()
    await send.settle()
    send.pending[0]?.reject(new Error("timeout"))
    await expect(failing).rejects.toThrow("timeout")
    await send.settle()
    send.pending[1]?.resolve()
    await waiting

    expect(send.batches).toEqual([["first"], ["first"]])
    expect(queue.size).toBe(0)
  })
})
