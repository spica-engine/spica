import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  mixin,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import {AuthModuleOptions, Type} from "@nestjs/passport";
import {defaultOptions} from "@nestjs/passport/dist/options";
import {memoize} from "@nestjs/passport/dist/utils/memoize.util";
import * as passport from "passport";

@Injectable()
export class AuthGuardService {
  constructor(@Optional() protected readonly options?: AuthModuleOptions) {}

  async check(request, response, type?: string): Promise<boolean> {
    const options = {...defaultOptions, ...this.options};
    if (options) {
      if (Array.isArray(this.options.defaultStrategy)) {
        throw "Default strategy can not be array.";
      } else {
        type = type || this.options.defaultStrategy;
      }
    }

    const passportFn = createPassportContext(request, response);

    const desiredStrategy = parseAuthHeader(request.headers.authorization);

    let strategyType: string;
    if (desiredStrategy) {
      strategyType = desiredStrategy.scheme.toLocaleLowerCase();
    } else {
      strategyType = type.toLowerCase();
    }

    request.headers["strategy-type"] = strategyType.toUpperCase();

    const user = await passportFn(strategyType, options, (err: Error, user: unknown) => {
      if (err) {
        throw new BadRequestException(err.message);
      }
      if (!user) {
        throw new UnauthorizedException();
      }
      return user;
    });

    request[options.property] = user;

    return true;
  }
}

export const AuthGuard: (type?: string) => Type<CanActivate> = memoize(createAuthGuard);

export function isAValidStrategy(type: string) {
  return type.toLowerCase() in passport._strategies;
}

export function createAuthGuard(type?: string): Type<CanActivate> {
  class MixinAuthGuard implements CanActivate {
    constructor(
      private authGuardService: AuthGuardService,
      @Optional() protected readonly options?: AuthModuleOptions
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest(),
        response = context.switchToHttp().getResponse();
      return this.authGuardService.check(request, response, type);
    }
  }
  return mixin(MixinAuthGuard);
}

const createPassportContext = (request, response) => (type, options, callback: Function) =>
  new Promise((resolve, reject) =>
    passport.authenticate(type, options, (err, user, info) => {
      try {
        request.authInfo = info;
        return resolve(callback(err, user, info));
      } catch (err) {
        reject(err);
      }
    })(request, response, err => (err ? resolve(callback(err)) : resolve))
  );

function parseAuthHeader(hdrValue) {
  const re = /(\S+)\s+(\S+)/;
  if (typeof hdrValue !== "string") {
    return null;
  }
  const matches = hdrValue.match(re);
  return matches && {scheme: matches[1], value: matches[2]};
}
