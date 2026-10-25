/**
 * Generic client-side rate limiter for API calls.
 * Phase 3.4: Rate-Limiting für API-Calls
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private timestamps: number[] = [];

  constructor(private config: RateLimitConfig) {}

  check(): void {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      (ts) => now - ts < this.config.windowMs
    );
    if (this.timestamps.length >= this.config.maxRequests) {
      const oldest = this.timestamps[0];
      const waitMs = this.config.windowMs - (now - oldest);
      throw new Error(
        `Rate limit exceeded. Bitte warte ${Math.ceil(waitMs / 1000)} Sekunden.`
      );
    }
    this.timestamps.push(now);
  }

  reset(): void {
    this.timestamps = [];
  }
}

export const apiRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
});
