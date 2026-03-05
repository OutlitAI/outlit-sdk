import type { IngestPayload, IngestResponse } from "@outlit/core"

// ============================================
// HTTP TRANSPORT
// ============================================

interface TransportErrorOptions {
  status?: number
  retryable?: boolean
  cause?: unknown
}

/**
 * Transport-level error enriched with retryability metadata.
 */
export class TransportError extends Error {
  readonly status?: number
  readonly retryable: boolean

  constructor(message: string, options?: TransportErrorOptions) {
    super(message)
    this.name = "TransportError"
    this.status = options?.status
    this.retryable = options?.retryable ?? true

    if (options?.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

function isRetryableStatus(status: number): boolean {
  // 429 is rate limiting (transient). Most other 4xx are configuration/input errors.
  return status === 429 || status >= 500
}

export interface TransportOptions {
  apiHost: string
  publicKey: string
  timeout?: number
}

export class HttpTransport {
  private apiHost: string
  private publicKey: string
  private timeout: number

  constructor(options: TransportOptions) {
    this.apiHost = options.apiHost
    this.publicKey = options.publicKey
    this.timeout = options.timeout ?? 10000
  }

  /**
   * Send events to the ingest API.
   */
  async send(payload: IngestPayload): Promise<IngestResponse> {
    const url = `${this.apiHost}/api/i/v1/${this.publicKey}/events`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "Unknown error")
        throw new TransportError(`HTTP ${response.status}: ${errorBody}`, {
          status: response.status,
          retryable: isRetryableStatus(response.status),
        })
      }

      return (await response.json()) as IngestResponse
    } catch (error) {
      if (error instanceof TransportError) {
        throw error
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new TransportError(`Request timed out after ${this.timeout}ms`, {
          retryable: true,
          cause: error,
        })
      }

      if (error instanceof Error) {
        throw new TransportError(error.message, {
          retryable: true,
          cause: error,
        })
      }

      throw new TransportError("Unknown transport error", {
        retryable: true,
        cause: error,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
