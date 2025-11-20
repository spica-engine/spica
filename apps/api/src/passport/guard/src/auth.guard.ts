import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  createParamDecorator,
  mixin,
  UnauthorizedException
} from "@nestjs/common";
import {Type} from "@nestjs/passport";
import {defaultOptions} from "@nestjs/passport/dist/options.js";
import passport from "passport";
import {memoize} from "@nestjs/passport/dist/utils/memoize.util.js";

export const StrategyType = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.strategyType;
});

export function isAValidStrategy(type: string) {
  return type.toLowerCase() in passport.strategies;
}

export const AuthGuard: (forbiddenStrategies?: string[]) => Type<CanActivate> =
  memoize(createAuthGuard);

export function createAuthGuard(forbiddenStrategies?: string[]): Type<CanActivate> {
  class MixinAuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest(),
        response = context.switchToHttp().getResponse();
      const options = {...defaultOptions};

      const passportFn = createPassportContext(request, response);

      const desiredStrategy = parseAuthHeader(request.headers.authorization);

      if (!desiredStrategy) {
        throw new UnauthorizedException("Authorization header is missing");
      }

      const strategyType = desiredStrategy.scheme.toLowerCase();

      checkForbiddenStrategy(forbiddenStrategies, strategyType);

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
  constructor(private forbiddenStrategies?: string[]) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest(),
      response = context.switchToHttp().getResponse();
    const options = {...defaultOptions};

    const passportFn = createPassportContext(request, response);

    const desiredStrategy = parseAuthHeader(request.headers.authorization);

    if (!desiredStrategy) {
      throw new UnauthorizedException("Authorization header is missing");
    }

    const strategyType = desiredStrategy.scheme.toLowerCase();

    checkForbiddenStrategy(this.forbiddenStrategies, strategyType);

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

function checkForbiddenStrategy(forbiddenStrategies: string[], strategyType: string): void {
  if (forbiddenStrategies && forbiddenStrategies.length > 0) {
    const isForbidden = forbiddenStrategies.some(
      forbidden => forbidden.toLowerCase() === strategyType.toLowerCase()
    );
    if (isForbidden) {
      throw new UnauthorizedException(`Strategy "${strategyType}" is forbidden`);
    }
  }
}
