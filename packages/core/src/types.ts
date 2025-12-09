/**
 * Event properties that can be attached to any event
 */
export interface EventProperties {
  [key: string]: string | number | boolean | null | undefined | string[] | number[];
}

/**
 * User identification properties
 */
export interface UserProperties {
  userId?: string;
  anonymousId?: string;
  email?: string;
  name?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Event to be tracked
 */
export interface Event {
  name: string;
  properties?: EventProperties;
  timestamp?: Date | string;
  userId?: string;
  anonymousId?: string;
}

/**
 * Configuration for the Outlit client
 */
export interface OutlitConfig {
  apiKey: string;
  apiUrl?: string;
  flushAt?: number;
  flushInterval?: number;
  maxQueueSize?: number;
  retryCount?: number;
  timeout?: number;
  debug?: boolean;
}

/**
 * Batch of events to send to the API
 */
export interface EventBatch {
  events: Event[];
  sentAt: string;
}

/**
 * API response structure
 */
export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}
