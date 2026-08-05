// Generated from packages/tools/src/generated/contracts.ts. Do not edit by hand.

export const ingestTransport = {
  method: "POST",
  pathTemplate: "/api/i/v1/{publicKey}/events",
  eventTypes: ["pageview", "form", "identify", "custom", "calendar", "engagement"],
} as const
