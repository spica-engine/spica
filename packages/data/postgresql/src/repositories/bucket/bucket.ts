import {Inject, Injectable} from "@nestjs/common";
import {isNotNull, jsonbRemove, Orm, sum} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {Bucket, BucketRepository, StoredBucket} from "@spica-server/interface-bucket";
import {buckets} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {entryStatus} from "../helpers.js";
import {decodeBucket, encodeBucket} from "./rows.js";

@Injectable()
export class PostgresBucketRepository implements BucketRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async findAll() {
    const found = await this.orm.findMany(buckets, {}, {orderBy: {_id: "asc"}});
    return found.map(decodeBucket) as StoredBucket[];
  }

  async findById(id: Id) {
    return decodeBucket(await this.orm.findById(buckets, id)) as StoredBucket | null;
  }

  async insert(bucket: Bucket) {
    return decodeBucket(await this.orm.insert(buckets, encodeBucket(bucket))) as StoredBucket;
  }

  async replaceById(id: Id, bucket: Bucket) {
    const replaced = await this.orm.replaceById(buckets, id, encodeBucket(bucket));
    return decodeBucket(replaced) as StoredBucket | null;
  }

  async deleteById(id: Id) {
    return decodeBucket(await this.orm.deleteById(buckets, id)) as StoredBucket | null;
  }

  async unsetProperties(id: Id, paths: string[]) {
    const subpathsByRoot = new Map<string, string[]>();
    for (const path of paths) {
      const [root, ...rest] = path.split(".");
      subpathsByRoot.set(root, [...(subpathsByRoot.get(root) ?? []), rest.join(".")]);
    }
    if (!subpathsByRoot.size) {
      return 0;
    }

    const changes: Record<string, unknown> = {};
    for (const [root, subpaths] of subpathsByRoot) {
      if (subpaths.includes("")) {
        changes[root] = null;
      } else if (buckets.groups.has(root)) {
        subpaths.forEach(subpath => (changes[`${root}.${subpath}`] = null));
      } else {
        changes[root] = jsonbRemove(subpaths);
      }
    }
    return (await this.orm.updateById(buckets, id, changes)) ? 1 : 0;
  }

  async sumOfCountLimits() {
    const {total} = await this.orm.aggregate(buckets, {total: sum("documentSettings.countLimit")});
    return total;
  }

  async findTranslatable() {
    const withProperties = await this.findWithProperties();
    return withProperties.flatMap(({_id, properties}) => {
      const translatable = Object.fromEntries(
        Object.entries(properties).filter(([, property]) => property.options?.translate === true)
      );
      return Object.keys(translatable).length ? [{_id, properties: translatable}] : [];
    }) as StoredBucket[];
  }

  async findReferencing(bucketId: string) {
    const withProperties = await this.findWithProperties();
    return withProperties
      .filter(({properties}) =>
        Object.values(properties).some(property => (property as any).bucketId == bucketId)
      )
      .map(({_id}) => String(_id));
  }

  private async findWithProperties() {
    const found = await this.orm.findMany(
      buckets,
      {properties: isNotNull()},
      {select: ["_id", "properties"], orderBy: {_id: "asc"}}
    );
    return found as {_id: Id; properties: NonNullable<Bucket["properties"]>}[];
  }

  status() {
    return entryStatus(this.orm, buckets, undefined);
  }
}
