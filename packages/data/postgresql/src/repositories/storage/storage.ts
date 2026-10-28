import {Inject, Injectable} from "@nestjs/common";
import {Orm, replacePrefix, startsWith, sum} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {
  StorageBrowseSpec,
  StorageObjectMeta,
  StorageRepository
} from "@spica-server/interface-storage";
import {storageObjects} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {browseWhere} from "./filters.js";

const SORTABLE = new Set([
  "_id",
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
    return this.orm.findMany(storageObjects, {_id: ids}, {orderBy: {_id: "asc"}});
  }

  findByNames(names: string[]) {
    return this.orm.findMany(storageObjects, {name: names}, {orderBy: {_id: "asc"}});
  }

  browse({resourceFilter, path, filter, sort, skip = 0, limit}: StorageBrowseSpec) {
    if (filter && Object.keys(filter).length) {
      throw new Error("Filtering storage objects is not supported on PostgreSQL yet.");
    }

    return this.orm.findMany(
      storageObjects,
      browseWhere(resourceFilter as {include?: string[]; exclude?: string[]}, path),
      {orderBy: orderBy(sort), limit: limit || undefined, offset: skip || undefined}
    );
  }

  findByNamePrefix(prefix: string) {
    return this.orm.findMany(storageObjects, {name: startsWith(prefix)}, {orderBy: {_id: "asc"}});
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
    return await this.orm.deleteWhere(storageObjects, {_id: ids});
  }

  deleteByNamePrefix(prefix: string) {
    return this.orm.deleteWhere(storageObjects, {name: startsWith(prefix)});
  }
}

function orderBy(sort?: object): Record<string, "asc" | "desc"> {
  const entries = Object.entries(sort ?? {});
  if (!entries.length) {
    return {_id: "asc"};
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
