import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
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
          }
        }
      ]);
    });

    it("should get indexes will be dropped", async () => {
      await bs._coll.createIndex({title: 1});
      await bs._coll.createIndex({description: -1});
      await bs._coll.createIndex({its: 1, compound: 1});

      const indexesWillBeDropped = await bs.getIndexesWillBeDropped();
      expect(indexesWillBeDropped).toEqual(["title_1", "description_-1"]);
    });

    it("should create bucket, update indexes", async () => {
      await bs._coll.createIndex({title: 1});

      // it should stay because it's compound
      await bs._coll.createIndex({title: 1, description: -1});

      const bucket: any = {
        properties: {
          title: {},
          description: {
            options: {
              index: 1
            }
          },
          email: {
            options: {
              unique: true
            }
          }
        }
      };

      let id;
      const insertedBucket: any = await bs.insertOne(bucket).then(r => {
        id = r._id;
        return r;
      });

      expect(insertedBucket).toEqual({
        _id: id,
        properties: {
          title: {},
          description: {
            options: {
              index: 1
            }
          },
          email: {
            options: {
              unique: true
            }
          }
        }
      });

      const indexes = await bs._coll.listIndexes().toArray();

      expect(indexes).toEqual([
        {v: 2, key: {_id: 1}, name: "_id_"},
        {
          v: 2,
          key: {title: 1, description: -1},
          name: "title_1_description_-1"
        },
        {v: 2, key: {description: 1}, name: "description_1"},
        {v: 2, unique: true, key: {email: 1}, name: "email_1"}
      ]);
    });
  });
});
