import {Test, TestingModule} from "@nestjs/testing";
import {
  DatabaseTestingModule,
  InsertOneWriteOpResult,
  InsertWriteOpResult
} from "@spica-server/database/testing";
import {BucketDataService} from "./bucket-data.service";

describe("bucket data service", () => {
  let module: TestingModule;
  let bds: BucketDataService;
  const bucketId = "superealbucketid";

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
      providers: [BucketDataService]
    }).compile();
    bds = module.get(BucketDataService);
  });

  afterAll(async () => {
    return await module.close();
  });

  beforeEach(async () => {
    return await bds.deleteAll(bucketId).catch(() => {});
  });

  it("should add an entry", async () => {
    let insertedRow: InsertOneWriteOpResult;
    await expectAsync(
      bds.insertOne(bucketId, {test: true, test2: "string", test3: 2}).then(r => (insertedRow = r))
    ).toBeResolved();
    return await expectAsync(
      bds.findOne(bucketId, {_id: insertedRow.insertedId}).then(r => {
        expect(r.test).toBe(true);
        expect(r.test2).toBe("string");
        expect(r.test3).toBe(2);
        return r;
      })
    ).toBeResolved();
  });

  it("should remove only one entry", async () => {
    let insertedRows: InsertWriteOpResult;
    await expectAsync(
      bds
        .insertMany(bucketId, [{platform: "ios"}, {platform: "android"}])
        .then(r => (insertedRows = r))
    ).toBeResolved();

    await expectAsync(bds.deleteOne(bucketId, {_id: insertedRows.insertedIds[0]})).toBeResolved();
    await expectAsync(bds.findOne(bucketId, {_id: insertedRows.insertedIds[0]})).toBeResolvedTo(
      null
    );

    return await expectAsync(
      bds.findOne(bucketId, {_id: insertedRows.insertedIds[1]}).then(r => {
        expect(r).not.toBeFalsy();
        expect(r.platform).toBe("android");
        return r;
      })
    ).toBeResolved();
  });

  it("should remove only many entries", async () => {
    let insertedRows: InsertWriteOpResult;
    let insertedRowArray = [];
    await expectAsync(
      bds
        .insertMany(bucketId, [{platform: "ios"}, {platform: "android"}])
        .then(r => (insertedRows = r))
    ).toBeResolved();
    insertedRowArray = [
      insertedRows.insertedIds[0].toHexString(),
      insertedRows.insertedIds[1].toHexString()
    ];
    await expectAsync(bds.deleteMany(bucketId, insertedRowArray)).toBeResolved();

    return await expectAsync(
      bds.find(bucketId, {_id: {$in: insertedRowArray}}).then(r => {
        expect(r.length).toBe(0);
      })
    ).toBeResolved();
  });

  it("should delete all entries", async () => {
    await bds.insertOne(bucketId, {platform: "ios"});
    await expectAsync(bds.deleteAll(bucketId)).toBeResolved();
    return expectAsync(bds.find(bucketId)).toBeResolvedTo([]);
  });

  it("should add new entries if no match", async () => {
    await expectAsync(bds.replaceOne(bucketId, {platform: "ios"})).toBeResolved();
    await expectAsync(bds.replaceOne(bucketId, {platform: "android"})).toBeResolved();
    return expectAsync(
      bds.find(bucketId).then(rows => {
        expect(rows).not.toEqual([]);
        expect(rows.length).toBe(2);
      })
    ).toBeResolved();
  });

  it("should update the entry with data._id", async () => {
    const insertOp = await bds.insertOne(bucketId, {platform: "android"});
    await expectAsync(
      bds.replaceOne(bucketId, {_id: insertOp.insertedId, platform: "ios"})
    ).toBeResolved();
    return expectAsync(
      bds.findOne(bucketId, {_id: insertOp.insertedId}).then(r => {
        expect(r).not.toBe(undefined);
        expect(r.platform).toBe("ios");
      })
    ).toBeResolved();
  });

  it("should update the entry with filter", async () => {
    const insertOp = await bds.insertOne(bucketId, {platform: "android"});
    await expectAsync(
      bds.replaceOne(bucketId, {platform: "ios"}, {_id: insertOp.insertedId})
    ).toBeResolved();
    return expectAsync(
      bds.findOne(bucketId, {_id: insertOp.insertedId}).then(r => {
        expect(r).not.toBe(undefined);
        expect(r.platform).toBe("ios");
      })
    ).toBeResolved();
  });
});
