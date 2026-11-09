import {Test, TestingModule} from "@nestjs/testing";
import {fieldTableName, mainTableName} from "@spica-server/data-postgresql";
import {provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {BUCKET_REPOSITORY, BUCKET_SCHEMA_MANAGER} from "@spica-server/interface-bucket";
import {BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {PG_POOL} from "@spica-server/interface-data";
import pg from "pg";

export const uuid = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;

export function postgresWriter() {
  let module: TestingModule;
  let writes: BucketWriteFacade;
  let pool: pg.Pool;
  const known = new Map<string, any>();
  let counter = 0;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_REPOSITORY), provideRepository(BUCKET_SCHEMA_MANAGER)]
    }).compile();
    await module.init();
    writes = module.get(BUCKET_WRITE);
    pool = module.get(PG_POOL);
  }, 120_000);

  afterAll(() => module.close());

  const context = () => ({
    resolveSchema: (id: unknown) => known.get(String(id)),
    deleteOne: async () => {}
  });

  return {
    async createBucket(properties: object, extra: object = {}) {
      const bucket = await module.get(BUCKET_SCHEMA_MANAGER).create(
        {
          title: `write ${++counter}`,
          description: "",
          primary: "id",
          acl: {read: "true==true", write: "true==true"},
          properties: {id: {type: "uuid", options: {generated: true}}, ...properties},
          ...extra
        } as any,
        () => {}
      );
      known.set(String(bucket._id), bucket);
      return bucket;
    },

    insert: (bucket: any, document: object) =>
      writes.insert(bucket, document as any, {}, context()),

    replace: (bucket: any, document: object, options: object = {}) =>
      writes.replace(bucket, document as any, options, context()),

    patch: (bucket: any, document: object, patch: object, options: object = {}) =>
      writes.patch(bucket, document as any, patch, options, context()),

    remove: (bucket: any, documentId: unknown, options: object = {}) =>
      writes.delete(bucket, documentId as any, options, context()),

    query: (text: string, values: unknown[] = []) => pool.query(text, values),

    rows: async (bucket: any) =>
      (await pool.query(`SELECT * FROM "${mainTableName(String(bucket._id))}" ORDER BY 1`)).rows,

    rowsOf: async (bucket: any, path: string, order = "1, 2") =>
      (
        await pool.query(
          `SELECT * FROM "${fieldTableName(String(bucket._id), path.split("."))}" ORDER BY ${order}`
        )
      ).rows
  };
}
