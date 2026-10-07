import { ingestTransport } from "./generated/ingest-contract"

export const INGEST_METHOD = ingestTransport.method
export const INGEST_EVENT_TYPES = ingestTransport.eventTypes

export function buildIngestUrl(apiHost: string, publicKey: string): string {
  const path = ingestTransport.pathTemplate.replace("{publicKey}", encodeURIComponent(publicKey))
  return `${apiHost.replace(/\/$/, "")}${path}`
}

// Hand-authored (not part of the generated ingest contract): the bootstrap
// endpoint reports whether the visitor's region requires opt-in consent.
const BOOTSTRAP_PATH_TEMPLATE = "/api/i/v1/{publicKey}/bootstrap"

export function buildBootstrapUrl(apiHost: string, publicKey: string): string {
  const path = BOOTSTRAP_PATH_TEMPLATE.replace("{publicKey}", encodeURIComponent(publicKey))
  return `${apiHost.replace(/\/$/, "")}${path}`
}
