import {Inject, Injectable, Optional} from "@nestjs/common";
import {Orm, quote} from "@spica-server/data-postgresql-orm";
import {
  Bucket,
  BUCKET_DATA_LIMIT,
  BucketDataRepository,
  BucketDocument
} from "@spica-server/interface-bucket";
import {BUCKET_QUERY, BucketQueryFacade} from "@spica-server/interface-bucket-common";
import {EntryStatus, Id, ProfilerQuery} from "@spica-server/interface-data";
import {ORM} from "../../orm.js";
import {fieldTableName, mainTableName} from "../../schema/index.js";
import {allBucketTables, countDocuments} from "./counts.js";

const unavailable = () => Promise.reject(new Error("Schemas and preferences are not read here."));

type Properties = NonNullable<Bucket["properties"]>;

function propertyAt(properties: Properties | undefined, path: string[]) {
  return path.reduce<any>(
    (property, segment, depth) =>
      depth == 0 ? properties?.[segment] : property?.properties?.[segment],
    undefined
  );
}

@Injectable()
export class PostgresBucketDataRepository implements BucketDataRepository {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(BUCKET_QUERY) private readonly query: BucketQueryFacade,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private readonly bucketDataLimit?: number
  ) {}

  async createStorage() {}

  async dropStorage() {}

  async syncIndexes() {}

  async clearRelation() {}

  async findById(bucket: Bucket, id: Id): Promise<BucketDocument | null> {
    const {result} = await this.query.findOne<BucketDocument>(
      bucket,
      {documentId: id},
      {resolveSchema: unavailable, preferences: unavailable}
    );
    return result ?? null;
  }

  async unsetFields(bucket: Bucket, paths: (string | number)[][]) {
    const localesByTable = new Map<string, string[]>();

    for (const path of paths) {
      const field = path.slice(0, -1).map(String);
      if (field.length && propertyAt(bucket.properties, field)?.options?.translate) {
        const table = fieldTableName(String(bucket._id), field);
        localesByTable.set(table, [...(localesByTable.get(table) ?? []), String(path.at(-1))]);
      }
    }

    await this.orm.transaction(async session => {
      for (const [table, locales] of localesByTable) {
        if (await session.tableExists(table)) {
          await session.raw(`DELETE FROM ${quote(table)} WHERE "_locale" = ANY($1::text[])`, [
            locales
          ]);
        }
      }
    });
  }

  async status(): Promise<EntryStatus> {
    const current = await countDocuments(this.orm, await allBucketTables(this.orm));
    return {limit: this.bucketDataLimit, current, unit: "count"};
  }

  async statusOf(bucket: Bucket): Promise<EntryStatus> {
    const current = await countDocuments(this.orm, [mainTableName(String(bucket._id))]);
    return {limit: bucket.documentSettings?.countLimit || undefined, current, unit: "count"};
  }

  async profilerEntries(_bucket: Bucket, _query: ProfilerQuery) {
    return [];
  }
}
