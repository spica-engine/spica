import {Inject, Injectable} from "@nestjs/common";
import {assertFilterLanguage} from "@spica-server/data";
import {and, Orm, replacePrefix, startsWith, sum} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {
  StorageBrowseSpec,
  StorageObjectMeta,
  StorageRepository
} from "@spica-server/interface-storage";
import {storageObjects} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {browseWhere} from "./filters.js";
import {expressionWhere} from "../expression-where.js";

const SORTABLE = new Set([
  "id",
  "name",
  "url",
  "created_at",
  "updated_at",
  "content.type",
  "content.size"
]);

@Injectable()
export class PostgresStorageRepository implements StorageRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  insert(object: StorageObjectMeta) {
    return this.orm.insert(storageObjects, object);
  }

  insertAll(objects: StorageObjectMeta[]) {
    return this.orm.insertMany(storageObjects, objects);
  }

  findById(id: Id) {
    return this.orm.findById(storageObjects, id);
  }

  findByName(name: string) {
    return this.orm.findOne(storageObjects, {name});
  }

  findByIds(ids: Id[]) {
    return this.orm.findMany(storageObjects, {id: ids}, {orderBy: {id: "asc"}});
  }

  findByNames(names: string[]) {
    return this.orm.findMany(storageObjects, {name: names}, {orderBy: {id: "asc"}});
  }

  async browse({resourceFilter, path, filter, sort, skip = 0, limit}: StorageBrowseSpec) {
    assertFilterLanguage(filter, ["expression"], "PostgreSQL");

    return this.orm.findMany(
      storageObjects,
      and(
        browseWhere(resourceFilter as {include?: string[]; exclude?: string[]}, path),
        expressionWhere(storageObjects, typeof filter == "string" ? filter : undefined)
      ),
      {orderBy: orderBy(sort), limit: limit || undefined, offset: skip || undefined}
    );
  }

  findByNamePrefix(prefix: string) {
    return this.orm.findMany(storageObjects, {name: startsWith(prefix)}, {orderBy: {id: "asc"}});
  }

  async totalSize() {
    const {total} = await this.orm.aggregate(storageObjects, {total: sum("content.size")});
    return total;
  }

  async updateById(id: Id, fields: Partial<StorageObjectMeta>) {
    await this.orm.updateById(storageObjects, id, fields);
  }

  async renamePrefix(oldName: string, newName: string) {
    await this.orm.updateMany(
      storageObjects,
      {name: startsWith(oldName)},
      {name: replacePrefix(oldName, newName)}
    );
  }

  deleteById(id: Id) {
    return this.orm.deleteById(storageObjects, id);
  }

  async deleteByName(name: string) {
    const [deleted] = await this.orm.deleteMany(storageObjects, {name});
    return deleted ?? null;
  }

  async deleteByIds(ids: Id[]) {
    return await this.orm.deleteWhere(storageObjects, {id: ids});
  }

  deleteByNamePrefix(prefix: string) {
    return this.orm.deleteWhere(storageObjects, {name: startsWith(prefix)});
  }
}

function orderBy(sort?: object): Record<string, "asc" | "desc"> {
  const entries = Object.entries(sort ?? {});
  if (!entries.length) {
    return {id: "asc"};
  }
  return Object.fromEntries(
    entries.map(([field, direction]) => {
      if (!SORTABLE.has(field)) {
        throw new Error(`Sorting storage objects by "${field}" is not supported.`);
      }
      return [field, direction == -1 ? "desc" : "asc"];
    })
  );
}
