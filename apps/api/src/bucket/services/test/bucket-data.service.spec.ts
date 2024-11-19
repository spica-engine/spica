import {Test, TestingModule} from "@nestjs/testing";
import {BucketDataService} from "@spica/api/src/bucket/services";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica/database";
import {BUCKET_DATA_LIMIT} from "@spica/api/src/bucket/services/src/options";

describe("Bucket Data Service", () => {
  describe("basics", () => {
    let module: TestingModule;
    let bds: BucketDataService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.standalone()],
        providers: [BucketDataService]
      }).compile();
      bds = module.get(BucketDataService);
    });

    afterEach(() => module.close());

    it("should create children correctly", () => {
      const id = new ObjectId();
      const result = bds.children({
        _id: id
      } as any);
      expect(result._collection).toEqual("bucket_" + id);
    });

    it("should insert entry without validating bucket-data limit", async () => {
      const coll = bds.children({
        _id: new ObjectId()
      } as any);

      // INSERT ONE
      const insertedDoc = await coll.insertOne({title: "1"});
      expect(insertedDoc.title).toEqual("1");

      // INSERT MANY
      await coll.insertMany([{title: "2"}, {title: "3"}]);
      const docs = await coll.find();
      expect(docs.map(d => d.title)).toEqual(["1", "2", "3"]);
    });
  });

  describe("with bucket-data limits", () => {
    let module: TestingModule;
    let db: DatabaseService;
    let bds: BucketDataService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.standalone()],
        providers: [{provide: BUCKET_DATA_LIMIT, useValue: 2}, BucketDataService]
      }).compile();
      db = module.get(DatabaseService);
      bds = module.get(BucketDataService);
    });

    afterEach(() => module.close());

    it("should insert entry if it does not cause to limit exceeding", async () => {
      const buckets = await db
        .collection("buckets")
        .insertMany([{title: "bucket1"}, {title: "bucket2"}] as any[])
        .then(r => Object.values(r.insertedIds));

      const bds1 = await bds.children({_id: buckets[0]} as any);
      let insertedDoc = await bds1.insertOne({title: "entry1"});
      expect(insertedDoc.title).toEqual("entry1");

      const bds2 = await bds.children({_id: buckets[1]} as any);
      insertedDoc = await bds2.insertOne({title: "entry2"});
      expect(insertedDoc.title).toEqual("entry2");
    });

    it("should not insert entry if it causes to limit exceeding", async () => {
      const buckets = await db
        .collection("buckets")
        .insertMany([{title: "bucket1"}, {title: "bucket2"}] as any[])
        .then(r => Object.values(r.insertedIds));

      const bds1 = await bds.children({_id: buckets[0]} as any);
      await bds1.insertOne({title: "entry1"});

      const bds2 = await bds.children({_id: buckets[1]} as any);
      await bds2.insertOne({title: "entry2"});

      // INSERT ONE
      await bds2.insertOne({title: "entry3"}).catch(e => {
        expect(e).toEqual(new Error("Total bucket-data limit exceeded"));
      });

      // INSERT MANY
      await bds2.deleteOne({title: "entry2"});
      await bds2.insertMany([{title: "entry3"}, {title: "entry4"}]).catch(e => {
        expect(e).toEqual(new Error("Total bucket-data limit exceeded"));
      });
    });
  });
});
