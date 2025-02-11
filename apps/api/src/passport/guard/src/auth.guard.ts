import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  createParamDecorator,
  mixin,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import {AuthModuleOptions, Type} from "@nestjs/passport";
import {defaultOptions} from "@nestjs/passport/dist/options";
import {memoize} from "@nestjs/passport/dist/utils/memoize.util";
import * as passport from "passport";
import {jwtDecode} from "jwt-decode";

export const StrategyType = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.strategyType;
});

export function isAValidStrategy(type: string) {
  return type.toLowerCase() in passport.strategies;
}

export const AuthGuard: (
  type?: string,
  error_handlers?: {
    bad_request: (message) => Error;
    unauthorized: (message) => Error;
  }
) => Type<CanActivate> = memoize(createAuthGuard);

export function createAuthGuard(type?: string): Type<CanActivate> {
  class MixinAuthGuard implements CanActivate {
    constructor(@Optional() private readonly options?: AuthModuleOptions) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest(),
        response = context.switchToHttp().getResponse();
      const options = {...defaultOptions, ...this.options};
      if (options) {
        if (Array.isArray(this.options.defaultStrategy)) {
          throw "Default strategy can not be an array.";
        } else {
          type = type || this.options.defaultStrategy || "NO_STRATEGY";
        }
      }

      const passportFn = createPassportContext(request, response);

      const desiredStrategy = parseAuthHeader(request.headers.authorization);

      let strategyType: string;
      let token: string;

      if (desiredStrategy) {
        strategyType = desiredStrategy.scheme.toLocaleLowerCase();
        token = desiredStrategy.value;
      } else {
        strategyType = type.toLowerCase();
      }

      request.strategyType = strategyType.toUpperCase();

      const user = await passportFn(
        strategyType,
        options,
        (err: Error, user: unknown, info: any) => {
          if (err) {
            throw new BadRequestException(err.message);
          }
          if (!user) {
            throw new UnauthorizedException(info ? info.message : undefined);
          }
          if (token) {
            let decodedToken;

            try {
              decodedToken = jwtDecode(token);
            } catch (e) {
              console.error("Invalid Token:", e.message);
            }

            if (decodedToken) {
              const deactivateJwtsBefore = user["deactivateJwtsBefore"];

              if (decodedToken.iat < deactivateJwtsBefore) {
                throw new UnauthorizedException("Invalid JWT");
              }
            }
          }
          return user;
        }
      );

      request[options.property] = user;

      return true;
    }
  }
  return mixin(MixinAuthGuard);
}

export class MixinAuthGuard implements CanActivate {
  constructor(
    @Optional() private readonly options?: AuthModuleOptions,
    private type?: string
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest(),
      response = context.switchToHttp().getResponse();
    const options = {...defaultOptions, ...this.options};
    if (options) {
      if (Array.isArray(this.options.defaultStrategy)) {
        throw "Default strategy can not be an array.";
      } else {
        this.type = this.type || this.options.defaultStrategy || "NO_STRATEGY";
      }
    }

    const passportFn = createPassportContext(request, response);

    const desiredStrategy = parseAuthHeader(request.headers.authorization);

    let strategyType: string;
    if (desiredStrategy) {
      strategyType = desiredStrategy.scheme.toLocaleLowerCase();
    } else {
      strategyType = this.type.toLowerCase();
    }

    request.strategyType = strategyType.toUpperCase();

    const user = await passportFn(strategyType, options, (err: Error, user: unknown, info: any) => {
      if (err) {
        throw new BadRequestException(err.message);
      }
      if (!user) {
        throw new UnauthorizedException(info ? info.message : undefined);
      }
      return user;
    });

    request[options.property] = user;

    return true;
  }
}

const createPassportContext = (request, response) => (type, options, callback: Function) =>
  new Promise((resolve, reject) =>
    passport.authenticate(type, options, (err, user, info) => {
      try {
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
