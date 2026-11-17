import {Test, TestingModule} from "@nestjs/testing";
import {fieldTableName, mainTableName, ORM} from "@spica-server/data-postgresql";
import {Orm} from "@spica-server/data-postgresql-orm";
import {provideRepository, idOf} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {BUCKET_REPOSITORY, BUCKET_SCHEMA_MANAGER} from "@spica-server/interface-bucket";
import {BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";

export const uuid = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;

export function postgresWriter() {
  let module: TestingModule;
  let writes: BucketWriteFacade;
  let orm: Orm;
  const known = new Map<string, any>();
  let counter = 0;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_REPOSITORY), provideRepository(BUCKET_SCHEMA_MANAGER)]
    }).compile();
    await module.init();
    writes = module.get(BUCKET_WRITE);
    orm = module.get(ORM);
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
      known.set(String(idOf(bucket)), bucket);
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

    query: (text: string, values: unknown[] = []) => orm.raw(text, values),

    rows: async (bucket: any) => {
      const rows = await orm.table(mainTableName(String(idOf(bucket)))).rows();
      return rows.sort((a, b) => compareBy(a, b, [Object.keys(a)[0]]));
    },

    rowsOf: async (bucket: any, path: string, order?: string) => {
      const rows = await orm.table(fieldTableName(String(idOf(bucket)), path.split("."))).rows();
      const keys = order
        ? [order]
        : ["_parent", rows[0]?._position === undefined ? "_locale" : "_position"];
      return rows.sort((a, b) => compareBy(a, b, keys));
    }
  };
}

function compareBy(a: Record<string, any>, b: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (a[key] != b[key]) {
      return a[key] < b[key] ? -1 : 1;
    }
  }
  return 0;
}
