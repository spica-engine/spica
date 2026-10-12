import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core-schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {BucketDataService} from "../src/bucket-data.service";
import {BucketService} from "../src/bucket.service";
import {BucketChangeDispatcher} from "../src/change-dispatcher";
import {MongoDatabase} from "@spica-server/database";

describe("Bucket Service", () => {
  /**
   * The fixtures wrote `properties: {}` while creating indexes on the fields `a`/`b`. That passes on
   * MongoDB because it is schemaless; in a relational model an index cannot be created on a property that
   * does not exist and the driver rejects it loudly (K-4) — the rejection is right, because an index on a
   * field that does not exist is a user error. The subject of the tests is the index **diff logic**, not
   * whether the fields exist; the fixture was made realistic.
   */
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
        providers: [BucketChangeDispatcher, BucketService, BucketDataService]
      }).compile();
      bs = module.get(BucketService);
      bds = module.get(BucketDataService);
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
          title: {type: "string"},
          description: {type: "string"},
          email: {type: "string"}
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
          title: {type: "string"},
          description: {type: "string"},
          email: {type: "string"}
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
          title: {type: "string"},
          description: {type: "string"},
          email: {type: "string"}
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
          title: {type: "string"},
          description: {type: "string"}
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

      /**
       * `explain()` is a diagnostic **specific to the MongoDB planner** and is not in the driver
       * contract; the assertion is therefore taken through the raw handle and only runs where that
       * planner exists.
       *
       * Its PostgreSQL counterpart is `EXPLAIN`, but **the same assertion cannot be made**: the planner
       * is cost based and on a four-row table a sequential scan is always cheaper, so "the index was
       * used" could only be verified with an artificial forcing such as `enable_seqscan = off`. That the
       * index really is used is verified in the driver's own measurement (§5.1 measured a
       * `Bitmap Index Scan` on a selective tag).
       *
       * The `queryProfiler` capability carries the distinction: this assertion depends on Mongo's planner
       * diagnostics.
       */
      if (bucketData.db.capabilities.backend !== "mongodb") {
        return;
      }

      const raw = (bucketData.db as MongoDatabase).raw.collection(bucketData.name);

      const standartQueryStage = await raw
        .find({description: 1})
        .explain()
        .then((r: any) => {
          return [r.executionStats.executionStages.stage, r.executionStats.totalDocsExamined];
        });
      expect(standartQueryStage).toEqual(["COLLSCAN", 4]);

      const indexedQueryStage = await raw
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
        properties: {a: {type: "string"}, b: {type: "string"}},
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
