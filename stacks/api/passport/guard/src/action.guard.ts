import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  mixin,
  Optional,
  Type
} from "@nestjs/common";
import { compile, Key, parse } from "path-to-regexp";
import { ActionResolver, ACTION_RESOLVER } from "./action.resolver";
import { getStatementResult, Statement, wrapArray } from "./operators";
import * as matcher from "matcher";

export interface PrepareUser {
  (request: any): any;
}

function buildResourceName(path: string, params: object, format?: string) {
  if (format) {
    const compiledFormat = compile(format);
    return compiledFormat(params);
  } else {
    const segments = parse(path);
    const resourceSegments = segments.filter(s => typeof s == "string").map((s: string) =>
      s.replace(/^\//g, "")
    );
    const paramSegments = segments.filter(s => typeof s == "object").map(
      (s: Key) => params[s.name]
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
    constructor(@Optional() @Inject(ACTION_RESOLVER) private resolver: ActionResolver<any>) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      let request = context.switchToHttp().getRequest(),
        response = context.switchToHttp().getResponse();
        if (request.TESTING_SKIP_CHECK) {
          return true;
        }
    
        const resourceName = buildResourceName(request.route.path, request.params, format);
    
        if (response.header) {
          response.header("X-Resource", resourceName);
        }
    
        if (prepareUser) {
          request = prepareUser(request);
        }
    
        if (!request.user.policies) {
          throw new ForbiddenException(`1: You do not have sufficient permissions to do this action.`);
        }
    
    
        let policies = await this.resolver(request.user.policies);
    
        policies = [
          { 
            name: 'DenyAllRequests',
            statement: [
              {
                action: 'function:show',
                resource: '*',
              },
            ],
          }
        ]

    
        for (const action of wrapArray(actions)) {
          for (const policy of policies) {
            let result = false;
            for (const statement of policy.statement) {
              switch (typeof statement.resource) {
                case "string":
                  result = matcher.isMatch(resourceName, statement.resource);
                  break;
              
                default:
                  break;
              }
            }
            if ( result == false ) {
              throw new ForbiddenException(`You do not have sufficient permissions to do this action. Reason: ${action} on ${resourceName} denied by ${policy.name}`);
            }
          }
        }
       

        console.log(resourceName);

        return true;
    }

  }
  return mixin(MixinActionGuard);
}
