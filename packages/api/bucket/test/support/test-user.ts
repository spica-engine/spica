import {CallHandler, ExecutionContext, Injectable, Module, NestInterceptor} from "@nestjs/common";
import {APP_INTERCEPTOR} from "@nestjs/core";
import {ids, withId} from "@spica-server/data";
import {Id} from "@spica-server/interface-data";

@Injectable()
class IdentifiedUser implements NestInterceptor {
  private userId?: Id;

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    this.userId ??= ids().forCollection("identity").generate();
    request.user = withId({...request.user}, this.userId);
    return next.handle();
  }
}

@Module({providers: [{provide: APP_INTERCEPTOR, useClass: IdentifiedUser}]})
export class IdentifiedUserModule {}
