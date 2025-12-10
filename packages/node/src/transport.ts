import type { IngestPayload, IngestResponse } from "@outlit/core"

// ============================================
// HTTP TRANSPORT
// ============================================

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
        throw new Error(`HTTP ${response.status}: ${errorBody}`)
      }

      return (await response.json()) as IngestResponse
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeout}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
