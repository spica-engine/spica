import {
  CanActivate,
  ConflictException,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Inject,
  mixin,
  Optional,
  Type
} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import * as matcher from "matcher";
import {compile, Key, parse} from "path-to-regexp";
import {PolicyResolver, POLICY_RESOLVER} from "./action.resolver";

export interface Statement {
  action: string;
  resource:
    | string
    | string[]
    | {
        include: string;
        exclude: string[];
      };
  module: string;
}

export function wrapArray(val: string | string[]) {
  return Array.isArray(val) ? val : Array(val);
}

export interface PrepareUser {
  (request: any): any;
}

export const ResourceFilter = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const {include, exclude: excluded} = request.resourceFilter;

  let aggregation = [];

  for (const exclude of excluded) {
    aggregation.push({
      _id: {
        $nin: Array.from<string>(new Set(exclude)).map(id => new ObjectId(id))
      }
    });
  }

  if (include.length) {
    aggregation.push({
      _id: {
        $in: Array.from<string>(new Set(include)).map(id => new ObjectId(id))
      }
    });
  }

  return {
    $match: {
      $or: aggregation
    }
  };
});

function buildResourceAndModuleName(path: string, params: object, format?: string) {
  if (format) {
    const compiledFormat = compile(format);
    path = compiledFormat(params);
  }
  const segments = parse(path);
  const resourceSegments = segments
    .filter(s => typeof s == "string")
    .map((s: string) => s.replace(/^\//g, ""));
  const paramSegments = segments.filter(s => typeof s == "object").map((s: Key) => params[s.name]);
  return {
    module: resourceSegments.join(":"),
    resource: paramSegments
  };
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
    constructor(@Optional() @Inject(POLICY_RESOLVER) private resolver: PolicyResolver<any>) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      let request = context.switchToHttp().getRequest(),
        response = context.switchToHttp().getResponse();
      if (request.TESTING_SKIP_CHECK) {
        return true;
      }

      if (prepareUser) {
        request = prepareUser(request);
      }

      let policies: Array<{name: string; statement: Statement[]}> = await this.resolver(
        request.user.policies || []
      );

      const resourceAndModule = buildResourceAndModuleName(
        request.route.path,
        request.params,
        format
      );

      if (response.header) {
        response.header("X-Policy-Module", resourceAndModule.module);
        response.header("X-Policy-Resource", resourceAndModule.resource || "partial");
      }

      let result = false;

      const include = [];
      const exclude = [];

      for (const action of wrapArray(actions)) {
        for (const policy of policies) {
          for (const statement of policy.statement) {
            const actionMatch = matcher.isMatch(action, statement.action);
            const moduleMatch = resourceAndModule.module == statement.module;

            console.log(statement.action, resourceAndModule.module, statement.module);

            if (actionMatch && moduleMatch) {
              let match: boolean;

              if (typeof statement.resource == "string" || Array.isArray(statement.resource)) {
                // Parse resources in such format bucketid/dataid thus we could match them individually
                const resources = wrapArray(statement.resource).map(resource =>
                  resource.split("/")
                );

                match = resources.some(resource =>
                  // Match all the positional resources when accessing to bucket data endpoints where the resource looks like below
                  // [ '5f30fffd4a51a68d6fec4d3b', '5f31002e4a51a68d6fec4d3f' ]
                  // where the first element is the id of the bucket while the second item is the identifier of the document
                  // hence all resources has to match in order to assume that the user has the access to a arbitrary resource
                  //
                  // IMPORTANT: when the resource definition is shorter than the resource present in the statement we only check parts
                  // that are present in the resource definition. for example,  when the resource definiton is [ '5f30fffd4a51a68d6fec4d3b']
                  // and resource in the statement is ["5f30fffd4a51a68d6fec4d3b", "5f31002e4a51a68d6fec4d3f"]
                  // we only check definition.resource[0] against resource[0] in the statement and the rest will be passed as mongodb aggregation
                  // to filter out in database layer.
                  resourceAndModule.resource.every((part, index) => part == resource[index])
                );

                const leftOverResources = [];

                for (const resource of resources) {
                  const leftOver = resource.slice(resourceAndModule.resource.length);
                  // if ( leftOver.length > 1 ) {
                  //   throw new ConflictException(
                  //       `The policy ${policy.name} contains invalid resource name '${resource.join("/")}'.` +
                  //       ` Resource ${resourceAndModule.module} ${action} only accepts ${resourceAndModule.resource.length} positional arguments.`
                  //   );
                  // }
                  if (leftOver.length) {
                    leftOverResources.push(leftOver[0]);
                  }
                }

                include.push(...leftOverResources);
              } else {
                const resource = statement.resource;
                // We need parse resources that has slash in it to match them individually.
                const includeParts = resource.include.split("/");

                match = resourceAndModule.resource.every((part, index) => {
                  const pattern = [includeParts[index]];
                  if (index == resourceAndModule.resource.length - 1) {
                    pattern.push(
                      ...resource.exclude.map(resource => `!${resource.split("/")[index]}`)
                    );
                  }
                  return matcher.isMatch(part, pattern);
                });

                exclude.push(statement.resource.exclude);
              }

              // If the current resource has names we have to check them explicitly
              // otherwise we just pass those to controllers to filter out in database layer
              if (match && actionMatch && moduleMatch) {
                result = true;
                // Resource is allowed therefore we don't need to go further and check other policies.
                break;
              }
            }
          }
        }
      }

      console.log(exclude);

      request.resourceFilter = {
        include,
        exclude
      };

      if (result) {
        return true;
      }

      throw new ForbiddenException(`You do not have sufficient permissions to do this action.`);
    }
  }
  return mixin(MixinActionGuard);
}
