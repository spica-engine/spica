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

      await bs.db
        .createCollection("buckets", {
          changeStreamPreAndPostImages: {enabled: true}
        })
        .catch(console.warn);
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      await module.close();
    });

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

      const insteredBucket = await bs.insertOne(bucket);
      expect(insteredBucket).toEqual({
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
      });
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

      const updatedBucket: any = {
        _id: bucketId,
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
      };

      await bs.findOneAndReplace({_id: bucketId}, updatedBucket);
      const newBucketSchema = await bs.findOne({_id: bucketId});
      expect(newBucketSchema).toEqual({
        _id: bucketId,
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
      });
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
      const originalBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {}
          }
        ]
      };

      await bs.insertOne(originalBucket);

      const updatedBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {b: 1},
            options: {}
          }
        ]
      };

      await bs.findOneAndReplace({_id: bucketId}, updatedBucket);
      const newBucketSchema = await bs.findOne({_id: bucketId});
      expect(newBucketSchema).toEqual({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {b: 1},
            options: {}
          }
        ]
      });
    });

    it("should update index if definition key order changes (compound)", async () => {
      const bucketId = new ObjectId();
      const originalBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1, b: 1},
            options: {}
          }
        ]
      };

      await bs.insertOne(originalBucket);

      const updatedBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {b: 1, a: 1},
            options: {}
          }
        ]
      };

      await bs.findOneAndReplace({_id: bucketId}, updatedBucket);
      const newBucketSchema = await bs.findOne({_id: bucketId});
      expect(newBucketSchema).toEqual({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {b: 1, a: 1},
            options: {}
          }
        ]
      });
    });

    it("should update index if key value changes (-1 => 1)", async () => {
      const bucketId = new ObjectId();
      const originalBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: -1},
            options: {}
          }
        ]
      };

      await bs.insertOne(originalBucket);

      const updatedBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {}
          }
        ]
      };

      await bs.findOneAndReplace({_id: bucketId}, updatedBucket);
      const newBucketSchema = await bs.findOne({_id: bucketId});
      expect(newBucketSchema).toEqual({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {}
          }
        ]
      });
    });

    it("should update index if options change", async () => {
      const bucketId = new ObjectId();
      const originalBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {}
          }
        ]
      };

      await bs.insertOne(originalBucket);

      const updatedBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true}
          }
        ]
      };

      await bs.findOneAndReplace({_id: bucketId}, updatedBucket);
      const newBucketSchema = await bs.findOne({_id: bucketId});
      expect(newBucketSchema).toEqual({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true}
          }
        ]
      });
    });

    it("should not update index if only options key order changes", async () => {
      const bucketId = new ObjectId();
      const originalBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {sparse: true, unique: true}
          }
        ]
      };

      await bs.insertOne(originalBucket);

      const reorderedOptionsBucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true, sparse: true}
          }
        ]
      };

      const dropIndexSpy = jest.spyOn(bs as any, "dropIndexes");
      const createIndexSpy = jest.spyOn(bs as any, "createIndexes");

      await bs.findOneAndReplace({_id: bucketId}, reorderedOptionsBucket);

      expect(dropIndexSpy.mock.calls.length).toEqual(1);
      const indexesToDrop = dropIndexSpy.mock.calls[0][1];
      expect(indexesToDrop).toEqual([]);

      expect(createIndexSpy.mock.calls.length).toEqual(1);
      const indexesToCreate = createIndexSpy.mock.calls[0][1];
      expect(indexesToCreate).toEqual([]);

      const newBucketSchema = await bs.findOne({_id: bucketId});
      expect(newBucketSchema).toEqual({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true, sparse: true}
          }
        ]
      });
    });

    it("should not update index if definition and options are the same", async () => {
      const bucketId = new ObjectId();
      const bucket: any = {
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true}
          }
        ]
      };

      await bs.insertOne(bucket);

      const dropIndexSpy = jest.spyOn(bs as any, "dropIndexes");
      const createIndexSpy = jest.spyOn(bs as any, "createIndexes");

      await bs.findOneAndReplace({_id: bucketId}, bucket);

      expect(dropIndexSpy.mock.calls.length).toEqual(1);
      const indexesToDrop = dropIndexSpy.mock.calls[0][1];
      expect(indexesToDrop).toEqual([]);

      expect(createIndexSpy.mock.calls.length).toEqual(1);
      const indexesToCreate = createIndexSpy.mock.calls[0][1];
      expect(indexesToCreate).toEqual([]);

      const newBucketSchema = await bs.findOne({_id: bucketId});
      expect(newBucketSchema).toEqual({
        _id: bucketId,
        properties: {},
        indexes: [
          {
            definition: {a: 1},
            options: {unique: true}
          }
        ]
      });
    });
  });
});
