import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  mixin,
  Optional,
  Type
} from "@nestjs/common";
import {idOf, ids} from "@spica-server/data";
import {POLICY_RESOLVER, PolicyResolver, Statement} from "@spica-server/interface-passport-guard";
import {ActionGuard} from "@spica-server/passport-guard";
import {StorageService} from "./storage.service.js";

type ObjectAction = "storage:show" | "storage:update" | "storage:delete";

@Injectable()
export class StorageObjectPolicy {
  constructor(
    private storage: StorageService,
    @Optional() @Inject(POLICY_RESOLVER) private resolver: PolicyResolver<any>
  ) {}

  // An object is addressable by id and by name, while ActionGuard only matches the one in the
  // request. This runs after it and can only narrow access.
  async assert(request: any, action: ObjectAction, idOrName: string): Promise<void> {
    if (request.TESTING_SKIP_CHECK) {
      return;
    }

    const policies = await this.resolver(request.user.policies || []);
    const statements: Statement[] = policies
      .flatMap(policy => policy.statement)
      .filter(statement => statement.action == action && statement.module == "storage");

    if (!statements.some(statement => (statement.resource as any)?.exclude?.length)) {
      return;
    }

    const objectIds = ids().forCollection("storage");
    const object = await this.storage.getMeta(
      objectIds.isValid(idOrName) ? objectIds.parse(idOrName) : idOrName
    );
    if (!object) {
      return;
    }

    const aliases = [String(idOf(object)), object.name];
    for (const statement of statements) {
      if (await this.grants(action, statement, aliases)) {
        return;
      }
    }

    throw new ForbiddenException(
      `You do not have sufficient permissions to do ${action} on resource ${idOrName}`
    );
  }

  private async grants(action: ObjectAction, statement: Statement, aliases: string[]) {
    const exclusionsOnly = {
      ...statement,
      resource: {include: ["*"], exclude: (statement.resource as any)?.exclude || []}
    } as Statement;

    const excluded = await Promise.all(
      aliases.map(async alias => !(await this.allows(action, exclusionsOnly, alias)))
    );
    if (excluded.includes(true)) {
      return false;
    }

    const included = await Promise.all(aliases.map(alias => this.allows(action, statement, alias)));
    return included.includes(true);
  }

  private async allows(action: ObjectAction, statement: Statement, alias: string) {
    const Guard = ActionGuard(action, "storage/:id", undefined, {resourceFilter: false});
    const request = {user: {policies: []}, route: {path: ""}, params: {id: alias}};
    const context = {
      switchToHttp: () => ({getRequest: () => request, getResponse: () => ({})})
    } as unknown as ExecutionContext;

    try {
      return (await new Guard(async () => [
        {name: "statement", statement: [statement]}
      ]).canActivate(context)) as boolean;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return false;
      }
      throw error;
    }
  }
}

export function storageObjectPolicy(action: ObjectAction, param: string): Type<CanActivate> {
  class MixinStorageObjectPolicy implements CanActivate {
    constructor(@Inject(StorageObjectPolicy) private objectPolicy: StorageObjectPolicy) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      await this.objectPolicy.assert(request, action, request.params[param]);
      return true;
    }
  }
  return mixin(MixinStorageObjectPolicy);
}
