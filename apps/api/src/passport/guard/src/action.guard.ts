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
import {Text, Parameter, parse} from "path-to-regexp";
import {PolicyResolver, POLICY_RESOLVER} from "./action.resolver";

export interface Statement {
  action: string;
  resource: {
    include: string[];
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

export const resourceFilterFunction = (
  data: {pure?: boolean} = {pure: false},
  ctx: ExecutionContext
) => {
  const request = ctx.switchToHttp().getRequest();
  const {include, exclude: excluded} = request.resourceFilter;

  if (data && data.pure) {
    return {
      includeds: include,
      excludeds: [].concat(...excluded)
    };
  }

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

  if (!aggregation.length) {
    return {
      $match: {}
    };
  }

  return {
    $match: {
      $or: aggregation
    }
  };
};

export const ResourceFilter = (data = {pure: false}) => {
  return createParamDecorator<{pure: boolean}>(resourceFilterFunction, [
    (target, key, index) => {
      Reflect.defineMetadata("resourceFilter", {key, index}, target.constructor);
    }
  ])(data);
};

function buildResourceAndModuleName(path: string, params: object, format?: string) {
  if (format) {
    path = format;
  }
  const segments = parse(path).tokens;
  const resourceSegments = segments
    .filter(s => s.type == "text")
    .map((s: Text) => s.value.replace(/^\//g, ""))
    .join("/")
    .split("/");
  const paramSegments = segments
    .filter(s => s.type == "param")
    .map((s: Parameter) => params[s.name]);

  return {
    module: resourceSegments.join(":"),
    resource: paramSegments
  };
}

function getLastSegment(resource: string[]) {
  return resource[resource.length - 1];
}

function isWildcard(segment: string): segment is "*" {
  return segment == "*";
}

export const ActionGuard: (
  actions: string | string[],
  format?: string,
  prepareUser?: PrepareUser,
  options?: {resourceFilter: boolean}
) => Type<CanActivate> = createActionGuard;

function createActionGuard(
  actions: string | string[],
  format?: string,
  prepareUser?: PrepareUser,
  options?: {resourceFilter: boolean}
): Type<CanActivate> {
  class MixinActionGuard implements CanActivate {
    constructor(@Optional() @Inject(POLICY_RESOLVER) private resolver: PolicyResolver<any>) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      let request = context.switchToHttp().getRequest(),
        response = context.switchToHttp().getResponse();

      if (request.TESTING_SKIP_CHECK) {
        request.resourceFilter = {
          include: [],
          exclude: []
        };
        return true;
      }

      let hasResourceFilter;

      if (options) {
        hasResourceFilter = options.resourceFilter;
      } else {
        // hasResourceFilter is true for just index endpoints
        const resourceFilterMetadata =
          Reflect.getMetadata("resourceFilter", context.getClass()) || {};
        hasResourceFilter = resourceFilterMetadata.key == context.getHandler().name;
      }

      actions = wrapArray(actions);

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
        response.header("X-Policy-Action", actions.join(", "));

        if (resourceAndModule.resource.length) {
          response.header("X-Policy-Resource", resourceAndModule.resource.join("/"));
        }

        if (hasResourceFilter) {
          response.header("X-Policy-Resource", "partial");
        }
      }

      let result = false;

      const include = [];
      const exclude = [];

      for (const action of actions) {
        for (const policy of policies) {
          for (const [index, statement] of policy.statement.entries()) {
            const actionMatch = action == statement.action;
            const moduleMatch = resourceAndModule.module == statement.module;

            if (actionMatch && moduleMatch) {
              let match: boolean;

              function assertResourceAgainstDefinition(resource: string[]) {
                const expectedResourceLength = hasResourceFilter
                  ? resourceAndModule.resource.length + 1
                  : resourceAndModule.resource.length;
                if (resource.length != expectedResourceLength) {
                  throw new ConflictException(
                    `Policy "${policy.name}" contains a statement [${index}] whose resource does not match the resource definition.` +
                      ` Expected ${expectedResourceLength} arguments.`
                  );
                }
              }

              if (typeof statement.resource == "object") {
                // INCLUDE THESE EXCLUDE NONE
                if (!statement.resource.exclude.length) {
                  // Parse resources in such format bucketid/dataid thus we could match them individually
                  const resources = wrapArray(statement.resource.include).map(resource =>
                    resource.split("/")
                  );

                  for (const resource of resources) {
                    assertResourceAgainstDefinition(resource);
                  }

                  const matchedResources = resources.filter(resource =>
                    // Match all the positional resources when accessing to bucket data endpoints where the resource looks like below
                    // [ '5f30fffd4a51a68d6fec4d3b', '5f31002e4a51a68d6fec4d3f' ]
                    // and the first element is the id of the bucket while the second item is the identifier of the document
                    // hence all resources has to match in order to assume that the user has the access to an arbitrary resource
                    //
                    // IMPORTANT: when the resource definition is shorter than the resource present in the statement we only check parts
                    // that are present in the resource definition. for example,  when the resource definiton is [ '5f30fffd4a51a68d6fec4d3b']
                    // and resource in the statement is ["5f30fffd4a51a68d6fec4d3b", "5f31002e4a51a68d6fec4d3f"]
                    // we only check definition.resource[0] against resource[0] in the statement and the rest will be passed as mongodb aggregation
                    // to filter out in database layer.
                    resourceAndModule.resource.every(
                      (part, index) => part == resource[index] || resource[index] == "*"
                    )
                  );

                  match = matchedResources.length > 0;

                  if (match && hasResourceFilter) {
                    for (const resource of matchedResources) {
                      include.push(getLastSegment(resource));
                    }
                  }
                } else {
                  // INCLUDE THIS EXCLUDE THESE
                  const resource = statement.resource;
                  // We need parse resources that has slash in it to match them individually.
                  const includeResource = resource.include[0].split("/");
                  assertResourceAgainstDefinition(includeResource);

                  const hasExcludedResources = resource.exclude && resource.exclude.length;

                  const excluded: string[][] = [];

                  if (hasExcludedResources) {
                    for (const excludeResource of resource.exclude) {
                      const excludedResource = excludeResource.split("/");
                      assertResourceAgainstDefinition(excludedResource);
                      excluded.push(excludedResource);
                    }
                  }

                  match = resourceAndModule.resource.every((part, index) => {
                    const pattern = [includeResource[index]];

                    // Since the exclude is optional we have check if it is present
                    if (hasExcludedResources) {
                      for (const resource of excluded) {
                        if (hasResourceFilter && getLastSegment(resource) == "*") {
                          // If all subresources excluded in index endpoint
                          pattern.push(`!${resource[index]}`);
                        } else if (
                          !hasResourceFilter &&
                          index == resourceAndModule.resource.length - 1 &&
                          getLastSegment(resource) != "*" // If one subresource excluded in non-index endpoint
                        ) {
                          pattern.push(`!${resource[index]}`);
                        } else if (!hasResourceFilter && getLastSegment(resource) == "*") {
                          // If all subresources excluded in non-index endpoint
                          pattern.push(`!${resource[0]}`);
                        }
                      }
                    }

                    return matcher.isMatch(part, pattern);
                  });

                  if (hasResourceFilter && match) {
                    include.push(getLastSegment(includeResource));

                    if (hasExcludedResources) {
                      const excludedResources = [];
                      for (const excludedResource of excluded) {
                        const lastSegment = getLastSegment(excludedResource);
                        // We don't need to put the wildcard segment into exclude array since
                        // the request will be rejected before reaching to the controller
                        // To clarify, lets say we have excluded all resources in the "base_resource"
                        // "base_resource/*" while allowing all of the other resources */*
                        // in this case the user has no to any resources under "base_resource" therefore
                        // the user gets rejected before reaching to the controller.
                        if (!isWildcard(lastSegment)) {
                          excludedResources.push(lastSegment);
                        }
                      }
                      if (excludedResources.length) {
                        exclude.push(excludedResources);
                      }
                    }
                  }
                }
              } else if (typeof statement.resource == "undefined") {
                // If the resource is not present then check against an empty array
                // which should be the equivalent of an undefined resource
                assertResourceAgainstDefinition([]);
                // If matches the definition then it is safe to mark this statement
                //  as the action and the module matches
                match = true;
              }

              // If the current resource has names, we have to check them explicitly.
              // otherwise we just pass those to controllers to filter out in database layer
              if (match) {
                result = true;
                if (!hasResourceFilter) {
                  // Resource is allowed therefore we don't need to go further and check other policies.
                  break;
                }
              }
            }
          }
        }
      }

      if (hasResourceFilter) {
        // If the include array has a wildcard resource that means we have to let all resources
        // to be present which can be accomplished by an empty array. See resource filter decorator
        // for more context.
        request.resourceFilter = {
          include: include.indexOf("*") != -1 ? [] : include,
          exclude
        };
      }

      if (result) {
        return true;
      }

      throw new ForbiddenException(
        `You do not have sufficient permissions to do ${actions.join(
          ", "
        )} on resource ${resourceAndModule.resource.join("/")}`
      );
    }
  }
  return mixin(MixinActionGuard);
}
