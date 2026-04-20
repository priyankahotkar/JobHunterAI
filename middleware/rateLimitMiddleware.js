/**
 * Create rate limit middleware
 * @param {RateLimitService} rateLimitService - Rate limit service instance
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
export function createRateLimitMiddleware(rateLimitService, options = {}) {
  const defaultOptions = {
    strategy: 'ip',              // Strategy: 'ip', 'user', 'api-key', etc.
    identifierExtractor: null,   // Custom function to extract identifier
    keyGenerator: null,          // Custom function to generate rate limit key
    maxRequests: null,           // Override max requests
    skipSuccessfulRequests: false, // Skip on successful responses
    skipFailedRequests: false,   // Skip on failed responses
    customHandler: null          // Custom error handler
  };

  const config = { ...defaultOptions, ...options };

  return async (req, res, next) => {
    try {
      // Extract identifier
      let identifier;
      
      if (config.identifierExtractor) {
        identifier = config.identifierExtractor(req);
      } else if (config.strategy === 'ip') {
        identifier = req.ip || req.connection.remoteAddress || 'unknown';
      } else if (config.strategy === 'user') {
        // Example: extract from auth header or session
        identifier = req.user?.id || req.get('Authorization') || 'anonymous';
      } else if (config.strategy === 'api-key') {
        identifier = req.get('X-API-Key') || 'no-key';
      } else {
        identifier = req.path; // Fallback to path
      }

      // Check rate limit
      const result = await rateLimitService.checkLimit(
        config.strategy,
        identifier,
        config.maxRequests
      );

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
      res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + result.resetIn);

      if (!result.allowed) {
        // Rate limit exceeded
        const errorResponse = {
          success: false,
          error: 'Rate limit exceeded',
          rateLimit: {
            limit: result.limit,
            remaining: result.remaining,
            resetIn: result.resetIn,
            resetAt: new Date(Date.now() + result.resetIn * 1000).toISOString()
          }
        };

        if (config.customHandler) {
          return config.customHandler(req, res, errorResponse);
        }

        return res.status(429).json(errorResponse);
      }

      // Store rate limit info in request for logging
      req.rateLimit = result;

      // Proceed to next middleware
      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // On error, allow request to go through
      next();
    }
  };
}

/**
 * Create endpoint-specific rate limit middleware
 * @param {RateLimitService} rateLimitService - Rate limit service instance
 * @param {string} endpoint - Endpoint identifier
 * @param {number} maxRequests - Max requests for this endpoint
 * @param {string} strategy - Rate limiting strategy
 * @returns {Function} Express middleware
 */
export function createEndpointRateLimitMiddleware(
  rateLimitService,
  endpoint,
  maxRequests,
  strategy = 'ip'
) {
  return createRateLimitMiddleware(rateLimitService, {
    strategy: strategy,
    maxRequests: maxRequests,
    identifierExtractor: (req) => {
      // Combine endpoint and strategy identifier
      const baseId = strategy === 'ip' 
        ? (req.ip || req.connection.remoteAddress || 'unknown')
        : (req.user?.id || req.get('Authorization') || 'anonymous');
      return `${endpoint}:${baseId}`;
    }
  });
}

/**
 * Create route-specific middleware factory
 * @param {RateLimitService} rateLimitService - Rate limit service instance
 * @param {Object} routeLimits - Map of routes to limit configs
 * @returns {Function} Express middleware
 */
export function createRouteSpecificRateLimitMiddleware(rateLimitService, routeLimits = {}) {
  const defaultLimit = routeLimits['*'] || { maxRequests: 5, strategy: 'ip' };

  return createRateLimitMiddleware(rateLimitService, {
    strategy: defaultLimit.strategy,
    maxRequests: defaultLimit.maxRequests,
    identifierExtractor: (req) => {
      // Get route-specific limit or use default
      const routeConfig = routeLimits[req.path] || routeLimits['*'];
      const strategy = routeConfig?.strategy || 'ip';
      
      let identifier;
      if (strategy === 'ip') {
        identifier = req.ip || req.connection.remoteAddress || 'unknown';
      } else if (strategy === 'user') {
        identifier = req.user?.id || 'anonymous';
      } else {
        identifier = 'default';
      }

      return `${req.path}:${identifier}`;
    },
    maxRequests: defaultLimit.maxRequests
  });
}