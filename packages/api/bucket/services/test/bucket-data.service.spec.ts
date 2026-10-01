import {Test, TestingModule} from "@nestjs/testing";
import {BucketDataService} from "@spica-server/bucket-services";
import {
  createAdHocCollection,
  DatabaseService,
  DatabaseTestingModule,
  ObjectId
} from "@spica-server/database-testing";
import {BUCKET_DATA_LIMIT} from "@spica-server/interface-bucket";

/**
 * Creates the bucket data table **beforehand** and returns the sub-collection.
 *
 * `bds.children({_id})` is called with a bare bucket object; MongoDB creates the namespace on the first
 * write, while a relational model needs a table (R68). Declaring a shape is unavoidable too: on PG neither
 * a row can be converted nor a filter compiled without knowing the column types. On the Mongo leg the
 * shape is ignored, so the spec does not know which backend it runs on.
 */
async function children(db: DatabaseService, bds: BucketDataService, id: ObjectId) {
  await createAdHocCollection(db, `bucket_${id}`, {title: {type: "string"}});
  return bds.children({_id: id} as any);
}

/**
 * Limit validation opens the data table of **every** bucket in the `buckets` collection
 * (`existingBucketData`), so all of them have to have been created beforehand — creating one and leaving
 * another out gives an `UnresolvedSchemaError`.
 */
async function createAll(db: DatabaseService, ids: ObjectId[]) {
  for (const id of ids) {
    await createAdHocCollection(db, `bucket_${id}`, {title: {type: "string"}});
  }
}

describe("Bucket Data Service", () => {
  describe("basics", () => {
    let module: TestingModule;
    let bds: BucketDataService;
    let db: DatabaseService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.standalone()],
        providers: [BucketDataService]
      }).compile();
      bds = module.get(BucketDataService);
      db = module.get(DatabaseService);
    });

    afterEach(() => module.close());

    it("should create children correctly", async () => {
      const id = new ObjectId();
      const result = await children(db, bds, id);
      expect(result.name).toEqual("bucket_" + id);
    });

    it("should insert entry without validating bucket-data limit", async () => {
      const coll = await children(db, bds, new ObjectId());

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
        .insertMany([{title: "bucket1"}, {title: "bucket2"}] as any[]);
      await createAll(db, buckets);

      const bds1 = await children(db, bds, buckets[0]);
      let insertedDoc = await bds1.insertOne({title: "entry1"});
      expect(insertedDoc.title).toEqual("entry1");

      const bds2 = await children(db, bds, buckets[1]);
      insertedDoc = await bds2.insertOne({title: "entry2"});
      expect(insertedDoc.title).toEqual("entry2");
    });

    it("should not insert entry if it causes to limit exceeding", async () => {
      const buckets = await db
        .collection("buckets")
        .insertMany([{title: "bucket1"}, {title: "bucket2"}] as any[]);
      await createAll(db, buckets);

      const bds1 = await children(db, bds, buckets[0]);
      await bds1.insertOne({title: "entry1"});

      const bds2 = await children(db, bds, buckets[1]);
      await bds2.insertOne({title: "entry2"});

      // INSERT ONE
      await expect(bds2.insertOne({title: "entry3"})).rejects.toEqual(
        new Error("Total bucket-data limit exceeded")
      );

      // INSERT MANY
      await bds2.deleteOne({title: "entry2"});
      await expect(bds2.insertMany([{title: "entry3"}, {title: "entry4"}])).rejects.toEqual(
        new Error("Total bucket-data limit exceeded")
      );
    });
  });
});
