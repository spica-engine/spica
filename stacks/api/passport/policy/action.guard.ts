import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  mixin,
  Optional,
  Type
} from "@nestjs/common";
import {Key, parse, compile} from "path-to-regexp";
import {Statement} from "./interface";
import {getStatementResult} from "./operators";
import {PolicyService} from "./policy.service";

export function memoize(fn: Function) {
  const cache = {};
  return (type: string | string[], format?: string) => {
    const n = `${(Array.isArray(type) ? type : [type]).join(",")}${format}`;
    if (n in cache) {
      return cache[n];
    } else {
      const result = fn(type, format);
      cache[n] = result;
      return result;
    }
  };
}

export const ActionGuard: (type: string | string[], format?: string) => Type<CanActivate> = memoize(
  createActionGuard
);

function createActionGuard(actions: string | string[], format?: string): Type<CanActivate> {
  class MixinActionGuard implements CanActivate {
    constructor(@Optional() private policy: PolicyService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();
      const resourceName = this.buildResourceName(request.route.path, request.params);

      response.header("X-Resource", resourceName);

      if (request.TESTING_SKIP_CHECK) {
        return true;
      }

      if (!request.user.policies) {
        this.throwException();
      }

      const policies = await this.policy._findAll();

      const identityPolicies = request.user.policies.map(p => policies.find(pp => pp._id == p));

      const statements: Array<Statement> = Array.prototype.concat.apply(
        [],
        identityPolicies.filter(item => item).map(ip => ip.statement)
      );

      const result = (Array.isArray(actions) ? actions : [actions]).map(action =>
        getStatementResult(statements, action, resourceName)
      );

      const canAccess =
        result.filter(r => r === true).length > 0 && result.filter(r => r === false).length == 0;

      if (!canAccess) {
        this.throwException();
      }

      return true;
    }

    throwException() {
      throw new ForbiddenException("You do not have sufficient permissions to do this action.");
    }

    buildResourceName(path: string, params: object) {
      if (format) {
        const compiledFormat = compile(format);
        return compiledFormat(params);
      } else {
        const segments = parse(path);
        const resourceSegments = (<string[]>segments.filter(s => typeof s == "string")).map(s =>
          s.replace(/^\//g, "")
        );
        const paramSegments = (<Key[]>segments.filter(s => typeof s == "object")).map(
          s => params[s.name]
        );
        return `${resourceSegments.join(":")}/${paramSegments.slice(0, 1).join("/")}`;
      }
    }
  }
  const guard = mixin(MixinActionGuard);
  return guard;
}
