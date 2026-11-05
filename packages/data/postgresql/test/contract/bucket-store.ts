/*
 * TEMPORARY. Gives the result shape contract one `createBucket / insert / read` surface over both
 * engines while PostgreSQL has no write or query facade.
 *
 * Remove it once these parts are merged, and use the facades from the specs directly:
 * - Part 9 binds BUCKET_WRITE on PostgreSQL: `insert` becomes `BUCKET_WRITE.insert`, on both engines.
 * - Part 8 binds BUCKET_QUERY on PostgreSQL: `read` becomes `BUCKET_QUERY.find`, on both engines.
 *   The facade calls RESULT_SHAPER itself, so fetchRowSet and the direct RESULT_SHAPER call go.
 * Then also delete ../shape/row-set-fixtures.ts. `createBucket` stays engine specific, because
 * PostgreSQL buckets need a primary key property.
 */
import {Provider} from "@nestjs/common";
import {TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {ContractEngine, DatabaseService} from "@spica-server/database-testing";
import {
  BUCKET_DATA_REPOSITORY,
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_MANAGER
} from "@spica-server/interface-bucket";
import {BUCKET_QUERY, BucketReadSpec} from "@spica-server/interface-bucket-common";
import {ID_TYPES, IdTypes, PG_POOL, RESULT_SHAPER} from "@spica-server/interface-data";
import pg from "pg";
import {fetchRowSet, insertDocument} from "../shape/row-set-fixtures.js";
import {describeAll} from "../shape/support.js";

type Fixture = Record<string, any>;

export interface ReadOptions {
  resolve?: string[];
  locale?: {best: string; fallback: string};
}

export interface BucketOptions {
  acl?: {read: string; write: string};
}

export interface BucketStore {
  readonly keyField: "_id" | "id";
  createBucket(properties: Fixture, options?: BucketOptions): Promise<any>;
  find(bucket: any, spec?: BucketReadSpec): Promise<any[]>;
  paginate(bucket: any, spec?: BucketReadSpec): Promise<{meta: {total: number}; data: any[]}>;
  insert(bucket: any, document: Fixture): Promise<unknown>;
  read(bucket: any, key: unknown, options?: ReadOptions): Promise<any>;
  reset(): void;
}

const preferences = {
  language: {available: {en_US: "English", tr_TR: "Turkish"}, default: "en_US"}
} as any;

export const bucketStoreProviders = (engine: ContractEngine): Provider[] => [
  provideRepository(BUCKET_REPOSITORY),
  provideRepository(BUCKET_SCHEMA_MANAGER),
  ...(engine.name == "mongodb" ? [provideRepository(BUCKET_DATA_REPOSITORY)] : [])
];

export function createBucketStore(engine: ContractEngine, module: TestingModule): BucketStore {
  const mongo = engine.name == "mongodb";
  let created: Record<string, any> = {};
  let counter = 0;

  const idType = () => module.get<IdTypes>(ID_TYPES).unscoped();
  const context = () => ({
    resolveSchema: id => created[String(id)],
    preferences: async () => preferences
  });

  return {
    keyField: mongo ? "_id" : "id",

    reset() {
      created = {};
    },

    async createBucket(properties, options = {}) {
      const bucket = await module.get(BUCKET_SCHEMA_MANAGER).create(
        {
          title: `shape ${++counter}`,
          description: "",
          icon: "",
          primary: mongo ? Object.keys(properties)[0] : "id",
          readOnly: false,
          history: false,
          order: 0,
          acl: options.acl ?? {read: "true==true", write: "true==true"},
          properties: mongo
            ? properties
            : {id: {type: "uuid", options: {generated: true}}, ...properties}
        } as any,
        () => {}
      );
      created[String(bucket._id)] = bucket;
      return bucket;
    },

    async find(bucket, spec = {}) {
      const {result} = await module.get(BUCKET_QUERY).find(bucket, spec, context());
      return JSON.parse(JSON.stringify(result));
    },

    async paginate(bucket, spec = {}) {
      const {result} = await module.get(BUCKET_QUERY).paginate(bucket, spec, context());
      return JSON.parse(JSON.stringify(result));
    },

    async insert(bucket, document) {
      const key = idType().generate();
      if (mongo) {
        await module
          .get(DatabaseService)
          .collection(`bucket_${bucket._id}`)
          .insertOne({_id: key, ...document} as any);
      } else {
        await insertDocument(
          module.get<pg.Pool>(PG_POOL),
          describeAll(created)(String(bucket._id)),
          {id: key, ...document}
        );
      }
      return key;
    },

    async read(bucket, key, {resolve = [], locale} = {}) {
      const result = mongo
        ? (
            await module.get(BUCKET_QUERY).find(
              bucket,
              {
                relationPaths: resolve.map(path => [path]),
                localize: Boolean(locale),
                language: locale?.best
              },
              {resolveSchema: id => created[String(id)], preferences: async () => preferences}
            )
          ).result[0]
        : await module
            .get(RESULT_SHAPER)
            .shape(
              {kind: "bucket", bucketId: String(bucket._id)},
              await fetchRowSet(
                module.get<pg.Pool>(PG_POOL),
                describeAll(created),
                String(bucket._id),
                key,
                resolve
              ),
              {locale}
            );
      return JSON.parse(JSON.stringify(result));
    }
  };
}
