import { OutlitClient, OutlitConfig, EventProperties, UserProperties } from '@outlit/core';

/**
 * Node.js-specific configuration
 */
export interface NodeConfig extends OutlitConfig {
  enableShutdownHooks?: boolean;
}

/**
 * Node.js SDK client
 */
export class OutlitNode extends OutlitClient {
  private nodeConfig: NodeConfig;
  private shutdownHandlersRegistered = false;

  constructor(config: NodeConfig) {
    super(config);
    this.nodeConfig = {
      enableShutdownHooks: true,
      ...config,
    };

    this.init();
  }

  /**
   * Initialize Node.js-specific functionality
   */
  private init(): void {
    if (this.nodeConfig.enableShutdownHooks && !this.shutdownHandlersRegistered) {
      this.registerShutdownHandlers();
    }
  }

  /**
   * Register shutdown handlers to flush events before exit
   */
  private registerShutdownHandlers(): void {
    const shutdownHandler = async () => {
      await this.shutdown();
    };

    // Handle graceful shutdown
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);

    // Handle uncaught exceptions
    process.on('beforeExit', shutdownHandler);

    this.shutdownHandlersRegistered = true;
  }

  /**
   * Track a server-side event with additional context
   */
  trackServer(eventName: string, properties?: EventProperties, context?: EventContext): void {
    const enrichedProperties = {
      ...properties,
      ...(context && this.extractContextProperties(context)),
    };

    this.track(eventName, enrichedProperties);
  }

  /**
   * Extract relevant properties from context (e.g., HTTP request)
   */
  private extractContextProperties(context: EventContext): EventProperties {
    const properties: EventProperties = {};

    if (context.ip) {
      properties.ip = context.ip;
    }

    if (context.userAgent) {
      properties.user_agent = context.userAgent;
    }

    if (context.url) {
      properties.url = context.url;
    }

    if (context.method) {
      properties.method = context.method;
    }

    if (context.headers) {
      // Only include safe headers as string array
      const safeHeaders = ['content-type', 'accept', 'accept-language'];
      const headerValues: string[] = [];

      safeHeaders.forEach((header) => {
        const value = context.headers?.[header];
        if (value) {
          headerValues.push(`${header}: ${value}`);
        }
      });

      if (headerValues.length > 0) {
        properties.headers = headerValues;
      }
    }

    return properties;
  }

  /**
   * Create a middleware function for Express/Koa/etc.
   */
  createMiddleware() {
    return (req: any, _res: any, next: any) => {
      const context: EventContext = {
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get?.('user-agent'),
        url: req.originalUrl || req.url,
        method: req.method,
        headers: req.headers,
      };

      // Attach tracking function to request
      req.outlit = {
        track: (eventName: string, properties?: EventProperties) => {
          this.trackServer(eventName, properties, context);
        },
        identify: (userId: string, properties?: UserProperties) => {
          this.identify(userId, properties);
        },
      };

      next();
    };
  }
}

/**
 * Event context for server-side tracking
 */
export interface EventContext {
  ip?: string;
  userAgent?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}
