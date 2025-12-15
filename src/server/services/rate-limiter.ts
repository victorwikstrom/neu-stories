/**
 * Simple in-memory rate limiter for MVP
 * 
 * Tracks recent requests by key and enforces cooldown periods
 * For production, consider Redis-based rate limiting
 */

interface RateLimitEntry {
  lastRequestTime: number;
  requestCount: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request is allowed
   * @param key - Unique identifier for the request (e.g., job ID, IP)
   * @param cooldownMs - Minimum time between requests in milliseconds
   * @returns Object with allowed status and remaining time
   */
  checkLimit(key: string, cooldownMs: number): {
    allowed: boolean;
    remainingMs?: number;
  } {
    const now = Date.now();
    const entry = this.requests.get(key);

    if (!entry) {
      // First request for this key
      this.requests.set(key, {
        lastRequestTime: now,
        requestCount: 1,
      });
      return { allowed: true };
    }

    const timeSinceLastRequest = now - entry.lastRequestTime;

    if (timeSinceLastRequest < cooldownMs) {
      // Too soon, rate limited
      const remainingMs = cooldownMs - timeSinceLastRequest;
      return {
        allowed: false,
        remainingMs,
      };
    }

    // Update the entry
    entry.lastRequestTime = now;
    entry.requestCount++;
    
    return { allowed: true };
  }

  /**
   * Remove old entries to prevent memory leaks
   */
  private cleanup() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [key, entry] of this.requests.entries()) {
      if (now - entry.lastRequestTime > maxAge) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Clear all rate limit data (useful for testing)
   */
  clear() {
    this.requests.clear();
  }

  /**
   * Clean up the interval timer
   */
  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

// Singleton instance for the application
const generateRateLimiter = new RateLimiter();

/**
 * Rate limit configuration for the Generate action
 */
export const GENERATE_RATE_LIMIT = {
  cooldownMs: 1000, // 1 second between requests per job
};

/**
 * Check if a generate request is allowed for a given job ID
 */
export function checkGenerateRateLimit(jobId: string): {
  allowed: boolean;
  remainingMs?: number;
} {
  return generateRateLimiter.checkLimit(jobId, GENERATE_RATE_LIMIT.cooldownMs);
}

/**
 * Export the rate limiter instance for testing
 */
export { generateRateLimiter };

