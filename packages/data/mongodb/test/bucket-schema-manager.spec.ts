import {Test, TestingModule} from "@nestjs/testing";
import {
  MongoBucketDataRepository,
  MongoBucketRepository,
  MongoBucketSchemaManager
} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database-testing";

describe("bucket schema manager", () => {
  let module: TestingModule;
  let db: DatabaseService;
  let buckets: MongoBucketRepository;
  let bucketData: MongoBucketDataRepository;
  let manager: MongoBucketSchemaManager;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    db = module.get(DatabaseService);
  });

  afterAll(() => module.close());

  beforeEach(() => {
    buckets = new MongoBucketRepository(db);
    bucketData = new MongoBucketDataRepository(db);
    manager = new MongoBucketSchemaManager(buckets, bucketData);
  });

  const bucket = (indexes: object[] = []) =>
    ({
      title: "b",
      primary: "title",
      acl: {read: "true==true", write: "true==true"},
      properties: {title: {type: "string"}},
      indexes
    }) as any;

  const indexNames = async (id: any) =>
    (await db.collection(`bucket_${id}`).listIndexes().toArray()).map(index => index.name);

  it("should save the definition, create the collection and sync indexes on create", async () => {
    const onSaved = jest.fn();

    const created = await manager.create(bucket([{definition: {title: 1}, options: {}}]), onSaved);

    expect(onSaved).toHaveBeenCalledWith(created);
    expect(await buckets.findById(created._id)).toEqual(created);
    expect(await indexNames(created._id)).toContain(bucketData.generateIndexName({title: 1}, {}));
  });

  it("should tell the observer about the definition before the structure work fails", async () => {
    const onSaved = jest.fn();
    jest.spyOn(bucketData, "syncIndexes").mockRejectedValueOnce(new Error("index failed"));

    await expect(manager.create(bucket(), onSaved)).rejects.toThrow("index failed");

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(await buckets.findById(onSaved.mock.calls[0][0]._id)).toBeTruthy();
  });

  it("should replace the definition and move the indexes on replace", async () => {
    const created = await manager.create(bucket([{definition: {title: 1}, options: {}}]), () => {});
    const onSaved = jest.fn();

    await manager.replace(
      created._id,
      bucket([{definition: {description: 1}, options: {}}]),
      onSaved
    );

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({_id: created._id}));
    const names = await indexNames(created._id);
    expect(names).toContain(bucketData.generateIndexName({description: 1}, {}));
    expect(names).not.toContain(bucketData.generateIndexName({title: 1}, {}));
  });

  it("should drop the definition and the collection on drop", async () => {
    const created = await manager.create(bucket(), () => {});
    const onSaved = jest.fn();

    const dropped = await manager.drop(created._id, onSaved);

    expect(dropped).toEqual(created);
    expect(onSaved).toHaveBeenCalledWith(created);
    expect(await buckets.findById(created._id)).toBeNull();
    const collections = await db.listCollections({name: `bucket_${created._id}`}).toArray();
    expect(collections).toEqual([]);
  });

  it("should resolve to null without notifying when the bucket does not exist", async () => {
    const created = await manager.create(bucket(), () => {});
    await manager.drop(created._id, () => {});
    const onSaved = jest.fn();

    expect(await manager.drop(created._id, onSaved)).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
