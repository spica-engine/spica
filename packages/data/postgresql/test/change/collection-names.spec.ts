import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {BUCKET_SCHEMA_MANAGER, BucketSchemaManager} from "@spica-server/interface-bucket";
import {COLLECTION_NAMES, CollectionNames} from "@spica-server/interface-data";

describe("PostgreSQL collection names", () => {
  let module: TestingModule;
  let names: CollectionNames;
  let manager: BucketSchemaManager;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_SCHEMA_MANAGER)]
    }).compile();
    await module.init();
    names = module.get(COLLECTION_NAMES);
    manager = module.get(BUCKET_SCHEMA_MANAGER);
  }, 120_000);

  afterAll(() => module.close());

  const bucket = () =>
    ({
      title: "Posts",
      description: "",
      icon: "",
      primary: "id",
      readOnly: false,
      history: false,
      order: 0,
      acl: {read: "true==true", write: "true==true"},
      properties: {
        id: {type: "uuid", options: {generated: true}},
        tags: {type: "array", items: {type: "string"}}
      }
    }) as any;

  it("should offer the collections of buckets, but not the tables that hold their lists", async () => {
    const created = await manager.create(bucket(), () => {});

    const collections = await names.list();

    expect(collections).toContain(`bucket_${created._id}`);
    expect(collections.filter(name => name.includes("__"))).toEqual([]);
  });

  it("should offer the system collections that report changes", async () => {
    const collections = await names.list();

    expect(collections).toEqual(
      expect.arrayContaining(["functions", "identities", "buckets", "function_assets"])
    );
  });

  it("should not offer the collections that do not report changes", async () => {
    const collections = await names.list();

    expect(collections).not.toContain("jobs");
    expect(collections).not.toContain("activities");
  });

  it("should report inserts, updates and deletes but no replacements", () => {
    expect(names.changeOperations()).toEqual(["insert", "update", "delete"]);
  });
});
