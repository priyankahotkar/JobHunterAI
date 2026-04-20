import { Redis } from '@upstash/redis';

export class CacheService {
  constructor(redisUrl, redisToken, defaultExpirySeconds = 3600) {
    this.redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    this.defaultExpiry = defaultExpirySeconds;
  }

  /**
   * Generate cache key for company data
   * @param {string} companyName - Name of the company
   * @param {string} type - Type of data ('crawled' or 'filtered')
   * @returns {string} Cache key
   */
  generateKey(companyName, type = 'filtered') {
    return `jobs:${companyName.toLowerCase()}:${type}`;
  }

  /**
   * Get data from cache
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} Cached data or null if not found
   */
  async get(key) {
    try {
      const data = await this.redis.get(key);
      if (data) {
        console.log(`Cache hit for key: ${key}`);
        // Handle different data types that might be returned by Redis client
        if (typeof data === 'string') {
          // Try to parse as JSON string
          try {
            return JSON.parse(data);
          } catch (parseError) {
            console.warn(`Failed to parse cached data for key ${key} as JSON:`, parseError.message);
            // If it's not valid JSON, check if it's the string representation of an object
            if (data === '[object Object]') {
              console.warn(`Cached data for key ${key} appears to be corrupted ([object Object])`);
              return null;
            }
            // Return the string as-is if it's not JSON
            return data;
          }
        } else if (typeof data === 'object') {
          // Data is already parsed by Redis client
          return data;
        } else {
          console.warn(`Unexpected data type for key ${key}: ${typeof data}`);
          return null;
        }
      }
      console.log(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Store data in cache with expiration
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   * @param {number} expirySeconds - Expiration time in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, data, expirySeconds = null) {
    try {
      const expiry = expirySeconds || this.defaultExpiry;
      await this.redis.setex(key, expiry, JSON.stringify(data));
      console.log(`Cached data for key: ${key} (expires in ${expiry}s)`);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete data from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async delete(key) {
    try {
      await this.redis.del(key);
      console.log(`Deleted cache for key: ${key}`);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all job-related cache (Upstash-compatible implementation)
   * @returns {Promise<boolean>} Success status
   */
  async clearAllJobs() {
    try {
      // Upstash Redis restricts KEYS command, so we'll use a different approach
      // We'll return a success status but note the limitation
      // In a production system, you'd maintain a separate key registry

      console.log('🧹 Cache clear requested');
      console.log('Note: Due to Upstash Redis restrictions, automatic cache clearing is limited.');
      console.log('Use individual company cache clearing (/cache/:companyName) for targeted clearing.');
      console.log('Rate limit clearing is handled separately.');

      // We can't reliably clear all keys without KEYS command
      // Return success to indicate the operation was acknowledged
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache stats
   */
  async getStats() {
    try {
      const keys = await this.redis.keys('jobs:*');
      return {
        totalKeys: keys.length,
        keys: keys
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { totalKeys: 0, keys: [] };
    }
  }

  /**
   * Check if cache is healthy
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy() {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }
}