import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Optional,
  Type
} from "@nestjs/common";
import {compile, Key, parse} from "path-to-regexp";
import {PrepareUser, Statement} from "./interface";
import {getStatementResult} from "./operators";
import {PolicyService} from "./policy.service";

@Injectable()
export class ActionGuardService {
  constructor(@Optional() private policy: PolicyService) {}

  async check(
    request,
    response,
    actions: string | string[],
    format?: string,
    prepareUser?: PrepareUser
  ): Promise<boolean> {
    const resourceName = buildResourceName(request.route.path, request.params, format);

    if (response.header) {
      response.header("X-Resource", resourceName);
    }

    if (request.TESTING_SKIP_CHECK) {
      return true;
    }

    if (prepareUser) {
      request = prepareUser(request);
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
      getStatementResult(request, statements, action, resourceName)
    );

    //is there any false
    if (result.some(val => val == false)) {
      this.throwException();
    }

    return true;
  }

  private throwException() {
    throw new ForbiddenException("You do not have sufficient permissions to do this action.");
  }
}

function buildResourceName(path: string, params: object, format?: string) {
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

export const ActionGuard: (
  actions: string | string[],
  format?: string,
  prepareUser?: PrepareUser
) => Type<CanActivate> = createActionGuard;

function createActionGuard(
  actions: string | string[],
  format?: string,
  prepareUser?: PrepareUser
): Type<CanActivate> {
  class MixinActionGuard implements CanActivate {
    constructor(@Optional() private actionGuardService: ActionGuardService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest(),
        response = context.switchToHttp().getResponse();
      return this.actionGuardService.check(request, response, actions, format, prepareUser);
    }
  }
  return mixin(MixinActionGuard);
}
