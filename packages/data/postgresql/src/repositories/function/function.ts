import {Inject, Injectable} from "@nestjs/common";
import {addToSet, has, Orm, pull} from "@spica-server/data-postgresql-orm";
import {getUpdateQueryForPatch} from "@spica-server/core-patch";
import {Id} from "@spica-server/interface-data";
import {
  Function,
  FUNCTION_OPTIONS,
  FunctionOptions,
  FunctionRepository,
  StoredFunction
} from "@spica-server/interface-function";
import {functions} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {assertCapacity, entryStatus, setPath, unsetPath} from "../helpers.js";

type ReferenceField = "env_vars" | "secrets";

@Injectable()
export class PostgresFunctionRepository implements FunctionRepository {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(FUNCTION_OPTIONS) private readonly options: FunctionOptions
  ) {}

  findAll() {
    return this.orm.findMany(functions, {}, {orderBy: {_id: "asc"}}) as Promise<StoredFunction[]>;
  }

  findSummaries() {
    return this.orm.findMany(
      functions,
      {},
      {select: ["_id", "name", "language"], orderBy: {_id: "asc"}}
    ) as Promise<StoredFunction[]>;
  }

  findById(id: Id) {
    return this.orm.findById(functions, id) as Promise<StoredFunction | null>;
  }

  findByName(name: string) {
    return this.orm.findOne(functions, {name}) as Promise<StoredFunction | null>;
  }

  findReferencing(field: ReferenceField, resourceId: Id) {
    return this.orm.findMany(
      functions,
      {[field]: has(resourceId)},
      {orderBy: {_id: "asc"}}
    ) as Promise<StoredFunction[]>;
  }

  async insert(fn: Function) {
    await assertCapacity(this.orm, functions, this.options.entryLimit);
    return (await this.orm.insert(functions, fn)) as StoredFunction;
  }

  updateById(id: Id, changes: Partial<Function>) {
    return this.orm.updateById(functions, id, changes, {
      returning: "before"
    }) as Promise<StoredFunction | null>;
  }

  async applyMergePatch(id: Id, patch: object, patched: Function) {
    const update = getUpdateQueryForPatch(patch, patched);
    if (!update) {
      return undefined;
    }

    return this.orm.transaction(async session => {
      const current = await session.findOne(functions, {_id: id}, {lock: "update"});
      if (!current) {
        return null;
      }

      const next = structuredClone(current) as Record<string, any>;
      const roots = new Set<string>();
      for (const [path, value] of Object.entries(update.$set ?? {})) {
        const keys = path.split(".");
        setPath(next, keys, value);
        roots.add(keys[0]);
      }
      for (const path of Object.keys(update.$unset ?? {})) {
        const keys = path.split(".");
        unsetPath(next, keys);
        roots.add(keys[0]);
      }

      const changes = Object.fromEntries([...roots].map(root => [root, next[root] ?? null]));
      return (await session.updateById(functions, id, changes)) as StoredFunction;
    });
  }

  async replaceById(id: Id, fn: Function) {
    return (await this.orm.replaceById(functions, id, fn)) ? 1 : 0;
  }

  deleteById(id: Id) {
    return this.orm.deleteById(functions, id) as Promise<StoredFunction | null>;
  }

  addEnvVar(id: Id, envVarId: Id) {
    return this.addReference(id, "env_vars", envVarId);
  }

  removeEnvVar(id: Id, envVarId: Id) {
    return this.removeReference(id, "env_vars", envVarId);
  }

  addSecret(id: Id, secretId: Id) {
    return this.addReference(id, "secrets", secretId);
  }

  removeSecret(id: Id, secretId: Id) {
    return this.removeReference(id, "secrets", secretId);
  }

  status() {
    return entryStatus(this.orm, functions, this.options.entryLimit);
  }

  private async addReference(id: Id, field: ReferenceField, resourceId: Id) {
    return this.orm.updateById(
      functions,
      id,
      {[field]: addToSet(resourceId)},
      {returning: "before"}
    ) as Promise<StoredFunction | null>;
  }

  private async removeReference(id: Id, field: ReferenceField, resourceId: Id) {
    return this.orm.updateById(
      functions,
      id,
      {[field]: pull(resourceId)},
      {returning: "before"}
    ) as Promise<StoredFunction | null>;
  }
}
