import {Inject, Injectable, Optional} from "@nestjs/common";
import {Collection, CreateIndexesOptions, DatabaseService} from "@spica-server/database";
import {Id, ProfilerQuery} from "@spica-server/interface-data";
import {
  Bucket,
  BUCKET_DATA_LIMIT,
  BucketDataRepository,
  IndexDefinition
} from "@spica-server/interface-bucket";
import {RelationType} from "@spica-server/interface-bucket-common";
import * as crypto from "crypto";
import {
  bucketDataCollection,
  bucketDataCollectionName,
  bucketDataStatus
} from "../../bucket/collections.js";
import {readProfiler} from "../profiler.js";

@Injectable()
export class MongoBucketDataRepository implements BucketDataRepository {
  constructor(
    private db: DatabaseService,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private bucketDataLimit?: number
  ) {}

  children(schema: Bucket) {
    return bucketDataCollection(this.db, schema, this.bucketDataLimit);
  }

  getStatus() {
    return bucketDataStatus(this.db, this.bucketDataLimit);
  }

  async createStorage(bucket: Bucket) {
    await this.db.createCollection(bucketDataCollectionName(bucket._id));
  }

  async dropStorage(bucketId: Id) {
    await this.db.dropCollection(bucketDataCollectionName(bucketId));
  }

  findById(bucket: Bucket, id: Id) {
    return this.children(bucket).findOne({_id: id});
  }

  async unsetFields(bucket: Bucket, paths: (string | number)[][]) {
    const fields = Object.fromEntries(
      paths.map(path => [path.join(".").replace(/\/\[0-9]\*\//g, "$[]"), ""])
    );
    await this.children(bucket).updateMany({}, {$unset: fields});
  }

  async clearRelation(bucket: Bucket, path: string, relationType: string, documentId: string) {
    const updateParams = getUpdateParams(path, relationType as RelationType, documentId);
    await this.children(bucket).updateMany(updateParams.filter, updateParams.update);
  }

  status() {
    return this.getStatus();
  }

  statusOf(bucket: Bucket) {
    return this.children(bucket).getStatus() as Promise<{
      limit?: number;
      current: number;
      unit: "count";
    }>;
  }

  profilerEntries(bucket: Bucket, query: ProfilerQuery) {
    return readProfiler(this.children(bucket).findOnProfiler(query.filter), query);
  }

  async syncIndexes(bucket: Bucket): Promise<void> {
    const collection = this.db.collection(bucketDataCollectionName(bucket._id));

    const existingIndexes = await collection.listIndexes().toArray();

    const existingNames = new Set(existingIndexes.map(index => index.name));

    const {indexesToDrop, indexesToCreate} = this.calculateIndexChanges(
      Array.from(existingNames),
      bucket
    );

    const errors = [];

    await this.dropIndexes(collection, indexesToDrop, errors);
    await this.createIndexes(collection, indexesToCreate, errors);

    if (errors.length) {
      throw new Error(errors.map(e => e.message).join("; "));
    }
  }

  generateIndexName(definition: Record<string, number>, options: Record<string, any>): string {
    const defsParts = [];
    for (const key of Object.keys(definition)) {
      defsParts.push(`${key}_${definition[key]}`);
    }
    const defs = defsParts.join("_");

    const sortedOptions: Record<string, any> = {};
    Object.keys(options)
      .sort()
      .forEach(k => {
        sortedOptions[k] = options[k];
      });

    const optionsStr = JSON.stringify(sortedOptions);

    const hash = crypto.createHash("sha1").update(optionsStr).digest("hex").slice(0, 8);

    return `${defs}-${hash}`;
  }

  calculateIndexChanges(
    existingIndexNames: string[],
    bucket: Bucket
  ): {
    indexesToDrop: string[];
    indexesToCreate: IndexDefinition[];
  } {
    const newIndexes = (bucket.indexes || []).map(idx => {
      const name = this.generateIndexName(idx.definition, idx.options || {});
      return {...idx, name};
    });

    const desiredNames = new Set(newIndexes.map(idx => idx.name));

    // _id is default index for MondoDB collections, we cant drop it
    // _id_ is internal name for _id index in MongoDB so we are filtering out
    const existingNames = new Set(existingIndexNames.filter(name => name !== "_id_"));

    const indexesToDrop = Array.from(existingNames).filter(name => !desiredNames.has(name));
    const indexesToCreate = newIndexes.filter(idx => !existingNames.has(idx.name));

    return {indexesToDrop, indexesToCreate};
  }

  async dropIndexes(collection: Collection, indexNames: string[], errors: Error[]): Promise<void> {
    await Promise.all(
      indexNames.map(name => collection.dropIndex(name).catch(err => errors.push(err)))
    );
  }

  async createIndexes(
    collection: Collection,
    indexes: IndexDefinition[],
    errors: Error[]
  ): Promise<void> {
    await Promise.all(
      indexes.map(idx =>
        collection
          .createIndex(idx.definition, {...idx.options, name: idx.name} as CreateIndexesOptions)
          .catch(err => errors.push(err))
      )
    );
  }
}

export function getUpdateParams(
  target: string,
  type: RelationType,
  documentId: string
): {filter: object; update: object} {
  if (type != RelationType.One && type != RelationType.Many) {
    throw new Error(`unknown relation type ${type}`);
  }

  if (type == RelationType.One) {
    return {filter: {[target]: documentId}, update: {$unset: {[target]: ""}}};
  } else if (type == RelationType.Many) {
    return {
      filter: {[target]: {$in: [documentId]}},
      update: {$pull: {[target]: documentId}}
    };
  }
}
