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

      const getFirstIp = (ip: string | string[] | undefined) => {
        if (!ip) return "";
        if (Array.isArray(ip)) {
          return ip[0];
        }
        return ip.split(",")[0].trim();
      };
      const ip =
        getFirstIp(request.headers["x-forwarded-for"]) ||
        getFirstIp(request.headers["x-real-ip"]) ||
        getFirstIp(request.ips) ||
        request.ip;

      if (!ip) {
        console.warn(
          "Could not determine client IP address for rate limiting. Allowing request by default."
        );
        return true;
      }

      // detect also whether ip address is public or private, and log it. Because if it's private, it means user is probably behind a proxy but proxy is not setting x-forwarded-for header, so we are treating all requests from that user as same single user which can cause unexpected rate limit blocks.
      // verify the following code
      const isPrivateIp = (ip: string) => {
        return (
          ip.startsWith("10.") ||
          ip.startsWith("192.168.") ||
          ip.startsWith("172.16.") ||
          ip.startsWith("172.17.") ||
          ip.startsWith("172.18.") ||
          ip.startsWith("172.19.") ||
          ip.startsWith("172.20.") ||
          ip.startsWith("172.21.") ||
          ip.startsWith("172.22.") ||
          ip.startsWith("172.23.") ||
          ip.startsWith("172.24.") ||
          ip.startsWith("172.25.") ||
          ip.startsWith("172.26.") ||
          ip.startsWith("172.27.") ||
          ip.startsWith("172.28.") ||
          ip.startsWith("172.29.") ||
          ip.startsWith("172.30.") ||
          ip.startsWith("172.31.")
        );
      };
      if (isPrivateIp(ip)) {
        console.warn(
          `Request from private IP address ${ip}. This may indicate a user behind a proxy.`
        );
      }

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
