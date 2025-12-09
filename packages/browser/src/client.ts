import { OutlitClient, OutlitConfig, EventProperties } from '@outlit/core';

/**
 * Browser-specific configuration
 */
export interface BrowserConfig extends OutlitConfig {
  autoPageViews?: boolean;
  capturePageTitle?: boolean;
  captureReferrer?: boolean;
  captureUtmParams?: boolean;
}

/**
 * Browser SDK client
 */
export class OutlitBrowser extends OutlitClient {
  private browserConfig: BrowserConfig;
  private hasTrackedInitialPage = false;

  constructor(config: BrowserConfig) {
    super(config);
    this.browserConfig = {
      autoPageViews: true,
      capturePageTitle: true,
      captureReferrer: true,
      captureUtmParams: true,
      ...config,
    };

    this.init();
  }

  /**
   * Initialize browser-specific functionality
   */
  private init(): void {
    if (typeof window === 'undefined') {
      throw new Error('OutlitBrowser can only be used in browser environments');
    }

    // Generate or retrieve anonymous ID
    this.ensureAnonymousId();

    // Track initial page view
    if (this.browserConfig.autoPageViews && !this.hasTrackedInitialPage) {
      this.pageView();
      this.hasTrackedInitialPage = true;
    }

    // Set up page view tracking on navigation
    if (this.browserConfig.autoPageViews) {
      this.setupNavigationTracking();
    }
  }

  /**
   * Ensure anonymous ID exists in localStorage
   */
  private ensureAnonymousId(): void {
    const storageKey = 'outlit_anonymous_id';
    let anonymousId = localStorage.getItem(storageKey);

    if (!anonymousId) {
      anonymousId = this.generateId();
      localStorage.setItem(storageKey, anonymousId);
    }

    // Set anonymous ID in user properties
    const currentUser = this.getUser();
    if (!currentUser.userId) {
      this.identify(anonymousId, { anonymousId });
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Track a page view
   */
  pageView(properties?: EventProperties): void {
    const pageProperties: EventProperties = {
      path: window.location.pathname,
      url: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
      ...properties,
    };

    if (this.browserConfig.capturePageTitle) {
      pageProperties.title = document.title;
    }

    if (this.browserConfig.captureReferrer) {
      pageProperties.referrer = document.referrer;
    }

    if (this.browserConfig.captureUtmParams) {
      const utmParams = this.getUtmParams();
      Object.assign(pageProperties, utmParams);
    }

    this.track('page_view', pageProperties);
  }

  /**
   * Extract UTM parameters from URL
   */
  private getUtmParams(): Record<string, string> {
    const params = new URLSearchParams(window.location.search);
    const utmParams: Record<string, string> = {};

    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

    utmKeys.forEach((key) => {
      const value = params.get(key);
      if (value) {
        utmParams[key] = value;
      }
    });

    return utmParams;
  }

  /**
   * Set up navigation tracking for SPAs
   */
  private setupNavigationTracking(): void {
    // Track history changes (for SPAs using History API)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.pageView();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.pageView();
    };

    // Track popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      this.pageView();
    });
  }

  /**
   * Override identify to save userId to localStorage
   */
  identify(userId: string, properties?: Record<string, unknown>): void {
    super.identify(userId, properties);
    localStorage.setItem('outlit_user_id', userId);
  }
}
