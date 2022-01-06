import {Test, TestingModule} from "@nestjs/testing";
import {BucketDataService} from "@spica-server/bucket/services";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {BucketService} from "../src";
import {BUCKET_DATA_LIMIT} from "../src/options";

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
        .insertMany([{title: "bucket1"}, {title: "bucket2"}] as any[]);

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

  fdescribe("relations ", () => {
    let module: TestingModule;
    let bs: BucketService;
    let bds: BucketDataService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.standalone(),
          PreferenceTestingModule,
          SchemaModule.forChild()
        ],
        providers: [BucketDataService, BucketService]
      }).compile();
      bs = module.get(BucketService);
      bds = module.get(BucketDataService);
    });

    it("should show", async () => {
      const userBucketId = new ObjectId();
      const buildingBucketId = new ObjectId();

      const userBucket = {
        _id: userBucketId,
        properties: {
          buildings: {
            type: "array",
            building: {
              type: "object",
              properties: {
                building: {
                  type: "relation",
                  bucketId: buildingBucketId,
                  relationType: "onetomany"
                },
                level: {
                  type: "number"
                }
              }
            }
          }
        }
      };

      const buildingBucket = {
        _id: buildingBucketId,
        properties: {
          name: {
            type: "string"
          }
        }
      };

      await bs.insertOne(userBucket as any);
      await bs.insertOne(buildingBucket as any);

      const userBucketData = bds.children(userBucket as any);
      const buildingBucketData = bds.children(buildingBucket as any);

      const insertedBuildings = await buildingBucketData.insertMany([
        {name: "tower"},
        {name: "basement"}
      ]);
      await userBucketData.insertOne({
        buildings: [
          {building: insertedBuildings[0], level: 2},
          {building: insertedBuildings[1], level: 37},
          {level: 3333}
        ]
      });

      const res = await userBucketData._coll
        .aggregate([
          {
            $lookup: {
              from: `bucket_${buildingBucketId}`,
              let: {
                documentIds: {
                  $ifNull: [
                    {
                      $map: {input: "$buildings.building", in: {$toObjectId: "$$this"}}
                    },
                    []
                  ]
                }
              },
              pipeline: [
                {
                  $match: {$expr: {$in: ["$_id", "$$documentIds"]}}
                }
              ],
              as: "_buildings"
            }
          }
        ])
        .toArray();
    });
  });
});
