import {CallHandler, ExecutionContext, Injectable, Module, NestInterceptor} from "@nestjs/common";
import {APP_INTERCEPTOR} from "@nestjs/core";
import {ids} from "@spica-server/data";

@Injectable()
class IdentifiedUser implements NestInterceptor {
  private _id?: unknown;

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    this._id ??= ids().forCollection("identity").generate();
    request.user = {...request.user, _id: this._id};
    return next.handle();
  }
}

@Module({providers: [{provide: APP_INTERCEPTOR, useClass: IdentifiedUser}]})
export class IdentifiedUserModule {}
