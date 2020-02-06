import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, InsertOneWriteOpResult} from "@spica-server/database/testing";
import {PreferenceModule} from "@spica-server/preference";
import {Bucket} from "./bucket";
import {BucketService} from "./bucket.service";

describe("bucket service", () => {
  let module: TestingModule;
  let bs: BucketService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create(), PreferenceModule, SchemaModule.forChild()],
      providers: [BucketService]
    }).compile();
    bs = module.get(BucketService);
  });

  afterAll(async () => {
    return await module.close();
  });

  it("should add an entry", async () => {
    const bucket: Bucket = {
      primary: "title"
    };
    let insertOp: InsertOneWriteOpResult;
    await expectAsync(bs.insertOne(bucket).then(r => (insertOp = r))).toBeResolved();
    return await expectAsync(
      bs.findOne({_id: insertOp.insertedId}).then(r => {
        expect(r).not.toBe(undefined);
        expect(r.primary).toBe(bucket.primary);
        return r;
      })
    ).toBeResolved();
  });

  it("should update an entry", async () => {
    const insertOp = await bs.insertOne({primary: "title"});
    await expectAsync(
      bs.replaceOne({_id: insertOp.insertedId, primary: "description"})
    ).toBeResolved();
    return expectAsync(
      bs.findOne({_id: insertOp.insertedId}).then(r => {
        expect(r).not.toBe(undefined);
        expect(r.primary).toBe("description");
        return r;
      })
    ).toBeResolved();
  });

  it("should delete all entries", async () => {
    await bs.insertOne({primary: "test"});
    await expectAsync(bs.deleteAll()).toBeResolvedTo(true);
    return await expectAsync(bs.find()).toBeResolvedTo([]);
  });

  it("should delete only one entry", async () => {
    const insertOp = await bs.insertMany([{primary: "title"}, {primary: "descriptionn"}]);
    await expectAsync(bs.deleteOne({_id: insertOp.insertedIds[0]})).toBeResolved();
    return await expectAsync(bs.findOne({_id: insertOp[0]})).toBeResolvedTo(null);
  });

  it("should empty default predefined defaults", () => {
    expect(bs.getPredefinedDefaults()).toEqual([]);
  });
});
