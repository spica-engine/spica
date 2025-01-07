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

    it("should create index definitions for basic types from bucket schema", () => {
      const bucket: any = {
        properties: {
          title: {
            options: {
              unique: true
            }
          },
          description: {
            options: {
              index: 1
            }
          }
        }
      };

      const indexDefinitions = bs.createIndexDefinitions(bucket);
      expect(indexDefinitions).toEqual([
        {
          definition: {
            title: 1
          },
          options: {
            unique: true
          }
        },
        {
          definition: {
            description: 1
          },
          options: {
            unique: false
          }
        }
      ]);
    });

    it("should create index definitions for arrays", () => {
      const bucket: any = {
        properties: {
          // string array
          tags: {
            type: "array",
            items: {
              type: "string",
              options: {
                index: true
              }
            }
          },
          // object array
          addresses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                city: {
                  type: "string",
                  options: {
                    index: true
                  }
                },
                street: {
                  type: "string"
                  // no index
                }
              }
            }
          }
        }
      };

      const indexDefinitions = bs.createIndexDefinitions(bucket);
      expect(indexDefinitions).toEqual([
        {
          definition: {
            tags: 1
          },
          options: {
            unique: false
          }
        },
        {
          definition: {
            "addresses.city": 1
          },
          options: {
            unique: false
          }
        }
      ]);
    });

    it("should create index definitions for objects", () => {
      const bucket: any = {
        properties: {
          info: {
            type: "object",
            properties: {
              age: {
                type: "number",
                options: {
                  index: true
                }
              },
              height: {
                // no index
                type: "number"
              },
              score: {
                type: "object",
                properties: {
                  best: {
                    type: "number",
                    options: {index: true}
                  },
                  // no index
                  worst: {
                    type: "number"
                  },
                  average: {
                    type: "number",
                    options: {index: true}
                  }
                }
              }
            }
          }
        }
      };

      const indexDefinitions = bs.createIndexDefinitions(bucket);
      expect(indexDefinitions).toEqual([
        {
          definition: {
            "info.age": 1
          },
          options: {
            unique: false
          }
        },
        {
          definition: {
            "info.score.best": 1
          },
          options: {
            unique: false
          }
        },
        {
          definition: {
            "info.score.average": 1
          },
          options: {
            unique: false
          }
        }
      ]);
    });

    it("should get indexes will be dropped", async () => {
      const bucket = await bs.insertOne({
        properties: {
          title: {
            options: {
              index: true
            }
          },
          description: {
            options: {
              index: true
            }
          }
        }
      } as any);

      const coll = bds.children(bucket)._coll;

      const indexesWillBeDropped = await bs.getIndexesWillBeDropped(coll);
      expect(indexesWillBeDropped).toEqual(["title_1", "description_1"]);
    });

    it("should create bucket and indexes", async () => {
      const bucketId = new ObjectId();
      const bucket: any = {
        _id: bucketId,
        properties: {
          title: {},
          description: {
            options: {
              index: true
            }
          },
          email: {
            options: {
              unique: true
            }
          }
        }
      };

      const insertedBucket: any = await bs.insertOne(bucket);

      expect(insertedBucket).toEqual({
        _id: bucketId,
        properties: {
          title: {},
          description: {
            options: {
              index: true
            }
          },
          email: {
            options: {
              unique: true
            }
          }
        }
      });

      const bucketData = bds.children(insertedBucket);

      const indexes = await bucketData._coll.listIndexes().toArray();
      expect(indexes.map(i => i.key)).toEqual([{_id: 1}, {description: 1}, {email: 1}]);
      expect(indexes[indexes.length - 1].unique).toEqual(true);
    });

    it("should replace bucket and indexes", async () => {
      const bucketId = new ObjectId();
      const bucket: any = {
        _id: bucketId,
        properties: {
          title: {},
          description: {
            options: {
              index: true
            }
          },
          email: {
            options: {
              unique: true
            }
          }
        }
      };

      await bs.insertOne(bucket);

      await bs.findOneAndReplace({_id: bucketId}, {
        properties: {
          title: {
            options: {index: true}
          },
          description: {},
          email: {
            options: {
              index: true
            }
          }
        }
      } as any);

      const bucketData = bds.children(bucket);
      const indexes = await bucketData._coll.listIndexes().toArray();
      expect(indexes.map(i => i.key)).toEqual([{_id: 1}, {title: 1}, {email: 1}]);
    });

    it("should use IXSCAN instead of COLLSCAN", async () => {
      const bucketId = new ObjectId();
      const bucket: any = {
        _id: bucketId,
        properties: {
          title: {
            options: {
              index: true
            }
          },
          description: {}
        }
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
  });
});
