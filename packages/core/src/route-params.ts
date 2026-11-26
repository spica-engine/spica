import {CanActivate, ExecutionContext, mixin, Type} from "@nestjs/common";

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
