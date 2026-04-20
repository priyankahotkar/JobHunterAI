import { Redis } from '@upstash/redis';

export class RateLimitService {
  constructor(redisUrl, redisToken, config = {}) {
    this.redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    
    // Default configuration
    this.config = {
      windowSizeSeconds: 60,  // 1 minute
      maxRequests: 5,          // 5 requests per minute
      ...config
    };
  }

  /**
   * Generate a rate limit key based on strategy and identifier
   * @param {string} strategy - Strategy type ('ip', 'user', 'api-key', etc.)
   * @param {string} identifier - Unique identifier (IP address, user ID, etc.)
   * @returns {string} Rate limit key
   */
  generateKey(strategy, identifier) {
    return `ratelimit:${strategy}:${identifier}`;
  }

  /**
   * Check if a request is allowed
   * @param {string} strategy - Strategy type
   * @param {string} identifier - Unique identifier
   * @param {number} maxRequests - Optional override for max requests
   * @returns {Promise<Object>} {allowed: boolean, remaining: number, resetIn: number}
   */
  async checkLimit(strategy, identifier, maxRequests = null) {
    const limit = maxRequests || this.config.maxRequests;
    const key = this.generateKey(strategy, identifier);

    try {
      // Get current count
      const current = await this.redis.get(key);
      const count = current ? parseInt(current) : 0;

      if (count >= limit) {
        // Limit exceeded
        const ttl = await this.redis.ttl(key);
        return {
          allowed: false,
          remaining: 0,
          resetIn: ttl > 0 ? ttl : this.config.windowSizeSeconds,
          limit: limit
        };
      }

      // Increment counter
      const newCount = count + 1;
      
      // Set with expiry (use setex)
      if (count === 0) {
        // First request, set expiry
        await this.redis.setex(key, this.config.windowSizeSeconds, newCount.toString());
      } else {
        // Increment existing key
        await this.redis.incr(key);
      }

      const ttl = await this.redis.ttl(key);
      return {
        allowed: true,
        remaining: limit - newCount,
        resetIn: ttl > 0 ? ttl : this.config.windowSizeSeconds,
        limit: limit
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // On error, allow request to go through (fail open)
      return {
        allowed: true,
        remaining: limit - 1,
        resetIn: this.config.windowSizeSeconds,
        limit: limit,
        error: error.message
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   * @param {string} strategy - Strategy type
   * @param {string} identifier - Unique identifier
   * @returns {Promise<boolean>} Success status
   */
  async resetLimit(strategy, identifier) {
    try {
      const key = this.generateKey(strategy, identifier);
      await this.redis.del(key);
      console.log(`Rate limit reset for ${strategy}:${identifier}`);
      return true;
    } catch (error) {
      console.error('Rate limit reset error:', error);
      return false;
    }
  }

  /**
   * Reset all rate limits
   * @returns {Promise<boolean>} Success status
   */
  async resetAllLimits() {
    try {
      const keys = await this.redis.keys('ratelimit:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`Cleared ${keys.length} rate limit entries`);
      }
      return true;
    } catch (error) {
      console.error('Reset all limits error:', error);
      return false;
    }
  }

  /**
   * Get rate limit stats
   * @returns {Promise<Object>} Stats
   */
  async getStats() {
    try {
      const keys = await this.redis.keys('ratelimit:*');
      return {
        totalLimitedIdentifiers: keys.length,
        keys: keys
      };
    } catch (error) {
      console.error('Rate limit stats error:', error);
      return { totalLimitedIdentifiers: 0, keys: [] };
    }
  }

  /**
   * Check service health
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy() {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Rate limit service health check failed:', error);
      return false;
    }
  }
}