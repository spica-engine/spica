import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {getBucketDataCollection} from "../src/bucket-data.service";
import {BucketService} from "../src/bucket.service";

describe("Bucket Service", () => {
  describe("index", () => {
    let module: TestingModule;
    let bs: BucketService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.standalone(),
          PreferenceTestingModule,
          SchemaModule.forChild()
        ],
        providers: [BucketService]
      }).compile();
      bs = module.get(BucketService);

      await bs.createCollection("buckets");
    });

    afterEach(() => module.close());

    it("should create index definitions from bucket schema", () => {
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

    it("should get indexes will be dropped", async () => {
      const bucket = bs.insertOne({
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

      const coll = bs.db.collection(getBucketDataCollection((await bucket)._id));

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

      const indexes = await bs.db
        .collection(getBucketDataCollection(bucketId))
        .listIndexes()
        .toArray();

      expect(indexes).toEqual([
        {v: 2, key: {_id: 1}, name: "_id_"},
        {v: 2, key: {description: 1}, name: "description_1"},
        {v: 2, unique: true, key: {email: 1}, name: "email_1"}
      ]);
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
        _id: bucketId,
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

      const collection = bs.db.collection(getBucketDataCollection(bucketId));
      const indexes = await collection.listIndexes().toArray();
      expect(indexes).toEqual([
        {v: 2, key: {_id: 1}, name: "_id_"},
        {v: 2, key: {title: 1}, name: "title_1"},
        {v: 2, key: {email: 1}, name: "email_1"}
      ]);
    });
  });
});
