import {Orm} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {BucketQueryFacade, BucketReadContext} from "@spica-server/interface-bucket-common";
import {StoredBuckets} from "../repositories/bucket/stored-buckets.js";
import {describeBucket, resolveRelationTargets} from "../schema/index.js";
import {LoadedRow} from "./loaded-row.js";

export const BUCKET_TABLE_PREFIX = "bucket_";

const unavailable = () => Promise.reject(new Error("Preferences are not read for changes."));

export class BucketLoader {
  private readonly stored: StoredBuckets;

  constructor(
    orm: Orm,
    private readonly query: BucketQueryFacade
  ) {
    this.stored = new StoredBuckets(orm);
  }

  async load(table: string, key: string, changedColumns: string[] = []): Promise<LoadedRow> {
    const bucketId = table.slice(BUCKET_TABLE_PREFIX.length);
    const bucket = await this.stored.find(bucketId);
    if (!bucket) {
      return {changedFields: []};
    }

    const context: BucketReadContext = {
      resolveSchema: async id => {
        const found = await this.stored.find(String(id));
        if (!found) {
          throw new Error(`The bucket "${id}" does not exist.`);
        }
        return found;
      },
      preferences: unavailable
    };
    const {result} = await this.query.findOne<Record<string, unknown>>(
      bucket,
      {documentId: {toString: () => key, toJSON: () => key}},
      context
    );
    return {document: result, changedFields: await this.fieldsOf(bucketId, bucket, changedColumns)};
  }

  private async fieldsOf(bucketId: string, bucket: Bucket, columns: string[]) {
    if (!columns.length) {
      return [];
    }
    const targets = await resolveRelationTargets(bucket, id => this.stored.find(String(id)));
    const fieldOf = new Map(
      describeBucket(bucketId, bucket, targets).main.columns.map(column => [
        column.name,
        column.path[0]
      ])
    );
    return [...new Set(columns.map(column => fieldOf.get(column)).filter(Boolean))];
  }
}
