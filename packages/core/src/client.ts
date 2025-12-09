import type {
  OutlitConfig,
  Event,
  EventProperties,
  UserProperties,
  EventBatch,
  ApiResponse,
} from './types';

/**
 * Base client for the Outlit SDK
 */
export class OutlitClient {
  private config: Required<OutlitConfig>;
  private queue: Event[] = [];
  private user: UserProperties = {};
  private flushTimer?: NodeJS.Timeout | number;

  constructor(config: OutlitConfig) {
    this.config = {
      apiUrl: 'https://api.outlit.ai/v1',
      flushAt: 20,
      flushInterval: 10000,
      maxQueueSize: 100,
      retryCount: 3,
      timeout: 5000,
      debug: false,
      ...config,
    };

    if (!this.config.apiKey) {
      throw new Error('API key is required');
    }

    this.startFlushTimer();
  }

  /**
   * Identify a user
   */
  identify(userId: string, properties?: UserProperties): void {
    this.user = {
      userId,
      ...properties,
    };

    if (this.config.debug) {
      console.log('[Outlit] User identified:', this.user);
    }
  }

  /**
   * Track an event
   */
  track(eventName: string, properties?: EventProperties): void {
    const event: Event = {
      name: eventName,
      properties,
      timestamp: new Date().toISOString(),
      userId: this.user.userId,
      anonymousId: this.user.anonymousId,
    };

    this.enqueue(event);
  }

  /**
   * Add event to queue and flush if needed
   */
  private enqueue(event: Event): void {
    if (this.queue.length >= this.config.maxQueueSize) {
      if (this.config.debug) {
        console.warn('[Outlit] Queue is full, dropping oldest event');
      }
      this.queue.shift();
    }

    this.queue.push(event);

    if (this.config.debug) {
      console.log('[Outlit] Event queued:', event);
    }

    if (this.queue.length >= this.config.flushAt) {
      this.flush();
    }
  }

  /**
   * Flush events to the API
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const eventsToSend = [...this.queue];
    this.queue = [];

    const batch: EventBatch = {
      events: eventsToSend,
      sentAt: new Date().toISOString(),
    };

    try {
      await this.sendBatch(batch);
    } catch (error) {
      if (this.config.debug) {
        console.error('[Outlit] Failed to send events:', error);
      }
      // Re-queue events if send failed
      this.queue.unshift(...eventsToSend);
    }
  }

  /**
   * Send batch to the API (to be implemented by platform-specific clients)
   */
  protected async sendBatch(batch: EventBatch): Promise<ApiResponse> {
    const url = `${this.config.apiUrl}/events`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(batch),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as ApiResponse;

      if (this.config.debug) {
        console.log('[Outlit] Events sent successfully:', result);
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Start the automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop the automatic flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer as number);
      this.flushTimer = undefined;
    }
  }

  /**
   * Shutdown the client and flush remaining events
   */
  async shutdown(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get current user
   */
  getUser(): UserProperties {
    return { ...this.user };
  }
}
