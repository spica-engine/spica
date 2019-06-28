import {AuthGuard as CoreAuthGuard, IAuthGuard, Type} from "@nestjs/passport";

export function AuthGuard(type?: string): Type<IAuthGuard> {
  return CoreAuthGuard(type);
}
