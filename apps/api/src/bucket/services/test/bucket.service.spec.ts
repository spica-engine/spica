import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {BucketDataService} from "../src/bucket-data.service";
import {BucketService} from "../src/bucket.service";

describe("Bucket Service", () => {
  describe("index", () => {
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
        providers: [BucketService, BucketDataService]
      }).compile();
      bs = module.get(BucketService);
      bds = module.get(BucketDataService);

      await bs.db.createCollection("buckets");
    });

    afterEach(() => module.close());
    it("should create all types of indexes", async () => {
      const bucketId = new ObjectId();
      const bucket: any = {
        _id: bucketId,
        properties: {
          title: {type: "string"},
          name: {type: "string"},
          surname: {type: "string"},
          email: {type: "string"},
          created_at: {type: "string", format: "date-time"},
          meta: {
            type: "object",
            title: "meta",
            properties: {
              score: {
                type: "number",
                title: "score"
              }
            }
          }
        },
        indexes: [
          {definition: {title: 1}, options: {}},
          {definition: {"meta.score": 1}, options: {}},
          {definition: {name: 1, surname: -1}, options: {}},
          {definition: {email: 1}, options: {unique: true}},
          {definition: {created_at: 1}, options: {expireAfterSeconds: 3600}}
        ]
      };

      const inserted = await bs.insertOne(bucket);
      const coll = bds.children(inserted)._coll;
      const indexes = await coll.listIndexes().toArray();

      const keys = indexes.map(i => i.key);
      expect(keys).toContainEqual({_id: 1});
      expect(keys).toContainEqual({title: 1});
      expect(keys).toContainEqual({"meta.score": 1});
      expect(keys).toContainEqual({name: 1, surname: -1});
      expect(keys).toContainEqual({email: 1});
      expect(keys).toContainEqual({created_at: 1});

      const emailIndex = indexes.find(i => JSON.stringify(i.key) === JSON.stringify({email: 1}));
      expect(emailIndex?.unique).toBe(true);

      const ttlIndex = indexes.find(i => JSON.stringify(i.key) === JSON.stringify({created_at: 1}));
      expect(ttlIndex?.expireAfterSeconds).toBe(3600);
    });

    it("should replace bucket and indexes", async () => {
      const bucketId = new ObjectId();
      await bs.insertOne({
        _id: bucketId,
        properties: {
          title: {},
          description: {},
          email: {}
        },
        indexes: [
          {
            definition: {description: 1},
            options: {}
          },
          {
            definition: {email: 1},
            options: {unique: true}
          }
        ]
      } as any);

      await bs.findOneAndReplace({_id: bucketId}, {
        properties: {
          title: {},
          description: {},
          email: {}
        },
        indexes: [
          {
            definition: {title: 1},
            options: {}
          },
          {
            definition: {email: 1},
            options: {unique: true}
          }
        ]
      } as any);

      const coll = bds.children({_id: bucketId} as any)._coll;
      const indexes = await coll.listIndexes().toArray();
      const keys = indexes.map(i => i.key);

      expect(keys).toEqual(expect.arrayContaining([{_id: 1}, {title: 1}, {email: 1}]));
    });

    it("should use IXSCAN instead of COLLSCAN", async () => {
      const bucketId = new ObjectId();
      const bucket: any = {
        _id: bucketId,
        properties: {
          title: {},
          description: {}
        },
        indexes: [
          {
            definition: {title: 1},
            options: {}
          }
        ]
      };

      await bs.insertOne(bucket);

      const bucketData = bds.children(bucket);
      await bucketData.insertMany([
        {title: 1, description: 1},
        {title: 2, description: 2},
        {title: 3, description: 3},
        {title: 4, description: 4}
      ]);

      const standartQueryStage = await bucketData._coll
        .find({description: 1})
        .explain()
        .then((r: any) => {
          return [r.executionStats.executionStages.stage, r.executionStats.totalDocsExamined];
        });
      expect(standartQueryStage).toEqual(["COLLSCAN", 4]);

      const indexedQueryStage = await bucketData._coll
        .find({title: 1})
        .explain()
        .then((r: any) => {
          return [
            r.executionStats.executionStages.inputStage.stage,
            r.executionStats.totalDocsExamined
          ];
        });
      expect(indexedQueryStage).toEqual(["IXSCAN", 1]);
    });

    it("should update index if definition key changes", async () => {
      const bucketId = new ObjectId();
      await bs.insertOne({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {}
          }
        ]
      } as any);

      await bs.findOneAndReplace({_id: bucketId}, {
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {}
          }
        ]
      } as any);

      const indexes = await bds
        .children({_id: bucketId} as any)
        ._coll.listIndexes()
        .toArray();
      expect(indexes.some(i => i.key.b === 1)).toBe(true);
      expect(indexes.some(i => i.key.a === 1)).toBe(false);
    });

    it("should update index if definition key order changes (compound)", async () => {
      const bucketId = new ObjectId();
      await bs.insertOne({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1, b: 1},
            options: {}
          }
        ]
      } as any);

      await bs.findOneAndReplace({_id: bucketId}, {
        properties: {},
        indexes: [
          {
            definition: {b: 1, a: 1},
            options: {}
          }
        ]
      } as any);

      const indexes = await bds
        .children({_id: bucketId} as any)
        ._coll.listIndexes()
        .toArray();
      expect(indexes.some(i => JSON.stringify(i.key) === JSON.stringify({b: 1, a: 1}))).toBe(true);
      expect(indexes.some(i => JSON.stringify(i.key) === JSON.stringify({a: 1, b: 1}))).toBe(false);
    });

    it("should update index if key value changes (-1 => 1)", async () => {
      const bucketId = new ObjectId();
      await bs.insertOne({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: -1},
            options: {}
          }
        ]
      } as any);

      await bs.findOneAndReplace({_id: bucketId}, {
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {}
          }
        ]
      } as any);

      const indexes = await bds
        .children({_id: bucketId} as any)
        ._coll.listIndexes()
        .toArray();
      expect(indexes.some(i => i.key.a === 1)).toBe(true);
      expect(indexes.some(i => i.key.a === -1)).toBe(false);
    });

    it("should update index if options change", async () => {
      const bucketId = new ObjectId();
      await bs.insertOne({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {}
          }
        ]
      } as any);

      await bs.findOneAndReplace({_id: bucketId}, {
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true}
          }
        ]
      } as any);

      const indexes = await bds
        .children({_id: bucketId} as any)
        ._coll.listIndexes()
        .toArray();
      expect(indexes.some(i => i.key.a === 1 && i.unique)).toBe(true);
    });

    it("should not update index if only options key order changes", async () => {
      const bucketId = new ObjectId();
      await bs.insertOne({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {sparse: true, unique: true}
          }
        ]
      } as any);

      await bs.findOneAndReplace({_id: bucketId}, {
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true, sparse: true}
          }
        ]
      } as any);

      const indexes = await bds
        .children({_id: bucketId} as any)
        ._coll.listIndexes()
        .toArray();
      const count = indexes.filter(i => JSON.stringify(i.key) === JSON.stringify({a: 1})).length;
      expect(count).toBe(1);
    });

    it("should not update index if definition and options are the same", async () => {
      const bucketId = new ObjectId();
      await bs.insertOne({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true}
          }
        ]
      } as any);

      await bs.findOneAndReplace({_id: bucketId}, {
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true}
          }
        ]
      } as any);

      const indexes = await bds
        .children({_id: bucketId} as any)
        ._coll.listIndexes()
        .toArray();
      const aIndexes = indexes.filter(i => JSON.stringify(i.key) === JSON.stringify({a: 1}));
      expect(aIndexes.length).toBe(1);
      expect(aIndexes[0].unique).toBe(true);
    });
  });
});
