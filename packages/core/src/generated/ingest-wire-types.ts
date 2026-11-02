// Generated from packages/tools/src/generated/contracts.ts. Do not edit by hand.

export type GeneratedIngestPayload = {
  visitorId?: string
  fingerprint?: string
  source?: "client" | "server" | "integration"
  events: Array<
    | {
        uuid?: string
        type: "pageview"
        timestamp: number
        url: string
        path: string
        referrer?: string
        utm?: {
          source?: string
          medium?: string
          campaign?: string
          term?: string
          content?: string
          ref?: string
        }
        customerId?: string
        customerTraits?: Record<string, string | number | boolean | null>
        title?: string
      }
    | {
        uuid?: string
        type: "form"
        timestamp: number
        url: string
        path: string
        referrer?: string
        utm?: {
          source?: string
          medium?: string
          campaign?: string
          term?: string
          content?: string
          ref?: string
        }
        customerId?: string
        customerTraits?: Record<string, string | number | boolean | null>
        formId?: string
        formFields?: Record<string, string>
      }
    | {
        uuid?: string
        type: "identify"
        timestamp: number
        url: string
        path: string
        referrer?: string
        utm?: {
          source?: string
          medium?: string
          campaign?: string
          term?: string
          content?: string
          ref?: string
        }
        email?: string
        userId?: string
        fingerprint?: string
        customerId?: string
        customerTraits?: Record<string, string | number | boolean | null>
        traits?: Record<string, string | number | boolean | null>
      }
    | {
        uuid?: string
        type: "custom"
        timestamp: number
        url: string
        path: string
        referrer?: string
        utm?: {
          source?: string
          medium?: string
          campaign?: string
          term?: string
          content?: string
          ref?: string
        }
        customerId?: string
        customerTraits?: Record<string, string | number | boolean | null>
        email?: string
        userId?: string
        fingerprint?: string
        eventName: string
        properties?: Record<string, unknown>
      }
    | {
        uuid?: string
        type: "calendar"
        timestamp: number
        url: string
        path: string
        referrer?: string
        utm?: {
          source?: string
          medium?: string
          campaign?: string
          term?: string
          content?: string
          ref?: string
        }
        customerId?: string
        customerTraits?: Record<string, string | number | boolean | null>
        provider: "cal.com" | "calendly" | "unknown"
        eventType?: string
        startTime?: string
        endTime?: string
        duration?: number
        isRecurring?: boolean
        inviteeEmail?: string
        inviteeName?: string
      }
    | {
        uuid?: string
        type: "engagement"
        timestamp: number
        url: string
        path: string
        referrer?: string
        utm?: {
          source?: string
          medium?: string
          campaign?: string
          term?: string
          content?: string
          ref?: string
        }
        customerId?: string
        customerTraits?: Record<string, string | number | boolean | null>
        activeTimeMs: number
        totalTimeMs: number
        sessionId: string
      }
  >
  sessionId?: string
  userIdentity?: {
    email?: string
    userId?: string
    fingerprint?: string
    traits?: Record<string, string | number | boolean | null>
  }
  customerIdentity?: {
    customerId?: string
    customerTraits?: Record<string, string | number | boolean | null>
  }
}

export type GeneratedIngestResponse = {
  success: boolean
  processed: number
  errors?: Array<{
    index: number
    message: string
  }>
}
