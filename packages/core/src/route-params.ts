import {CanActivate, ExecutionContext, mixin, Type} from "@nestjs/common";

// Express 5 yields a wildcard parameter as a list of segments. It has to be joined before the
// authorization guards, otherwise policy resources are matched against each segment on its own.
export function joinWildcardParam(name: string): Type<CanActivate> {
  class MixinJoinWildcardParam implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const {params} = context.switchToHttp().getRequest();
      if (Array.isArray(params[name])) {
        params[name] = params[name].join("/");
      }
      return true;
    }
  }
  return mixin(MixinJoinWildcardParam);
}
