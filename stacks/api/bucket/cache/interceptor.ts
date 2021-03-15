import {
  CacheInterceptor,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  mixin,
  NestInterceptor,
  Optional
} from "@nestjs/common";
import {BucketCacheService} from "./service";

export class BucketCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest();
    const path = req.path;
    const language = req.get("accept-language");
    return path + "&accept-language=" + language;
  }
}

export class DisabledCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): any {
    return next.handle();
  }
}

export function cache(): any {
  class DecisionClass {
    constructor(@Optional() @Inject() cacheService: BucketCacheService) {
      if (cacheService) {
        return BucketCacheInterceptor;
      } else {
        return DisabledCacheInterceptor;
      }
    }
  }
  return mixin(DecisionClass);
}
