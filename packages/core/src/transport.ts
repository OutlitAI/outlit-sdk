import { ingestTransport } from "../../tools/src/generated/contracts"

export const INGEST_METHOD = ingestTransport.method
export const INGEST_EVENT_TYPES = ingestTransport.eventTypes

export function buildIngestUrl(apiHost: string, publicKey: string): string {
  const path = ingestTransport.pathTemplate.replace("{publicKey}", encodeURIComponent(publicKey))
  return `${apiHost.replace(/\/$/, "")}${path}`
}
