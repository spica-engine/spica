import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  Type,
  mixin
} from "@nestjs/common";
import {CACHE_MANAGER} from "@nestjs/cache-manager";
import {Cache} from "cache-manager";

export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed within the time window
   */
  limit: number;
  /**
   * Time window in seconds
   */
  ttl: number;
  /**
   * Optional custom key generator function
   */
  keyGenerator?: (context: ExecutionContext) => string;
}

/**
 * Rate limiting guard to prevent abuse of endpoints.
 * Uses cache-manager to track request counts per user/IP within a time window.
 */
export function RateLimitGuard(options: RateLimitOptions): Type<CanActivate> {
  class RateLimitGuardImplementation implements CanActivate {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();

      // Skip rate limiting in test environments
      if (request.TESTING_SKIP_CHECK) {
        return true;
      }

      // Generate a unique key for this request
      const key = options.keyGenerator
        ? options.keyGenerator(context)
        : this.generateDefaultKey(request);

      // Get current request count
      const currentCount = (await this.cacheManager.get<number>(key)) || 0;

      // Check if rate limit is exceeded
      if (currentCount >= options.limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: "Too many requests. Please try again later.",
            retryAfter: options.ttl
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      // Increment the request count
      await this.cacheManager.set(key, currentCount + 1, options.ttl * 1000);

      return true;
    }

    /**
     * Generate a default key based on user ID or IP address
     */
    private generateDefaultKey(request: any): string {
      const userId = request.user?._id?.toString() || request.user?.id;
      const ip = request.ip || request.connection?.remoteAddress || "unknown";
      const path = request.route?.path || request.url;

      // Prefer user ID if available (for authenticated requests)
      const identifier = userId || ip;

      return `rate-limit:${path}:${identifier}`;
    }
  }

  return mixin(RateLimitGuardImplementation);
}
