import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  mixin
} from "@nestjs/common";
import {Type} from "@nestjs/common/interfaces";
import {RateLimitService} from "./rate-limit.service";

export function RateLimitGuard(group: string): Type<CanActivate> {
  class MixinRateLimitGuard implements CanActivate {
    constructor(@Inject(RateLimitService) private readonly rateLimitService: RateLimitService) {}

    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();

      const ip = request.ips?.length ? request.ips[0] : request.ip;

      const result = this.rateLimitService.checkLimit(group, ip);

      if (result.limit === 0) {
        return true;
      }

      response.setHeader("X-RateLimit-Limit", result.limit);
      response.setHeader("X-RateLimit-Remaining", result.remaining);
      response.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
        response.setHeader("Retry-After", retryAfter);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: "Too many requests. Please try again later.",
            error: "Too Many Requests"
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      return true;
    }
  }

  return mixin(MixinRateLimitGuard);
}
