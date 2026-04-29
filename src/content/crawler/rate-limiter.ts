import { RATE_LIMIT } from '../../shared/constants';
import { sleep } from '../../shared/utils';

export interface RateLimitConfig {
  minDelay: number;
  defaultDelay: number;
  maxDelay: number;
  retryAttempts: number;
  backoffMultiplier: number;
}

/**
 * Request throttling and rate limiting
 */
export class RateLimiter {
  private lastRequestTime: number = 0;
  private consecutiveErrors: number = 0;
  private config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      minDelay: config?.minDelay ?? RATE_LIMIT.MIN_DELAY,
      defaultDelay: config?.defaultDelay ?? RATE_LIMIT.DEFAULT_DELAY,
      maxDelay: config?.maxDelay ?? RATE_LIMIT.MAX_DELAY,
      retryAttempts: config?.retryAttempts ?? RATE_LIMIT.RETRY_ATTEMPTS,
      backoffMultiplier: config?.backoffMultiplier ?? RATE_LIMIT.BACKOFF_MULTIPLIER,
    };
  }

  /**
   * Wait before next request
   */
  async wait(): Promise<void> {
    const delay = this.calculateDelay();
    await sleep(delay);
  }

  /**
   * Execute function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.wait();

    try {
      this.lastRequestTime = Date.now();
      const result = await fn();
      this.consecutiveErrors = 0;
      return result;
    } catch (error) {
      this.consecutiveErrors++;
      throw error;
    }
  }

  /**
   * Execute function with retry
   */
  async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        return await this.execute(fn);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[RateLimiter] Attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < this.config.retryAttempts - 1) {
          const backoffDelay = this.calculateBackoffDelay(attempt);
          await sleep(backoffDelay);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Calculate delay based on consecutive errors
   */
  private calculateDelay(): number {
    if (this.consecutiveErrors === 0) {
      return this.config.defaultDelay;
    }

    const exponentialDelay = this.config.defaultDelay *
      Math.pow(this.config.backoffMultiplier, this.consecutiveErrors);

    return Math.min(exponentialDelay, this.config.maxDelay);
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = this.config.defaultDelay *
      Math.pow(this.config.backoffMultiplier, attempt);

    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Get current delay
   */
  getCurrentDelay(): number {
    return this.calculateDelay();
  }

  /**
   * Get consecutive error count
   */
  getConsecutiveErrors(): number {
    return this.consecutiveErrors;
  }

  /**
   * Reset error counter
   */
  resetErrors(): void {
    this.consecutiveErrors = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Check if should respect robots.txt
   */
  async checkRobotsTxt(url: string): Promise<boolean> {
    try {
      const robotsUrl = new URL('/robots.txt', url).href;
      const response = await fetch(robotsUrl);

      if (!response.ok) {
        // No robots.txt or error, allow request
        return true;
      }

      const text = await response.text();
      const path = new URL(url).pathname;

      // Simple robots.txt parser
      const lines = text.split('\n');
      let userAgentMatch = false;

      for (const line of lines) {
        const trimmed = line.trim().toLowerCase();

        // Check for user-agent section
        if (trimmed.startsWith('user-agent:')) {
          const userAgent = trimmed.split(':')[1].trim();
          userAgentMatch = userAgent === '*' || userAgent.includes('recruitscout');
        }

        // Check for disallow rules
        if (userAgentMatch && trimmed.startsWith('disallow:')) {
          const disallowPath = trimmed.split(':')[1].trim();
          if (path.startsWith(disallowPath)) {
            console.warn(`[RateLimiter] Path ${path} is disallowed by robots.txt`);
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.warn('[RateLimiter] Error checking robots.txt:', error);
      return true;
    }
  }

  /**
   * Get delay based on crawl delay directive
   */
  async getCrawlDelay(url: string): Promise<number> {
    try {
      const robotsUrl = new URL('/robots.txt', url).href;
      const response = await fetch(robotsUrl);

      if (!response.ok) {
        return this.config.defaultDelay;
      }

      const text = await response.text();
      const lines = text.split('\n');
      let userAgentMatch = false;

      for (const line of lines) {
        const trimmed = line.trim().toLowerCase();

        if (trimmed.startsWith('user-agent:')) {
          const userAgent = trimmed.split(':')[1].trim();
          userAgentMatch = userAgent === '*' || userAgent.includes('recruitscout');
        }

        if (userAgentMatch && trimmed.startsWith('crawl-delay:')) {
          const delay = parseFloat(trimmed.split(':')[1].trim());
          if (!isNaN(delay)) {
            return Math.max(delay * 1000, this.config.minDelay);
          }
        }
      }

      return this.config.defaultDelay;
    } catch {
      return this.config.defaultDelay;
    }
  }
}

export const rateLimiter = new RateLimiter();
