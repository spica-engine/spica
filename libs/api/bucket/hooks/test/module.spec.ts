import {Test, TestingModule} from "@nestjs/testing";
import {createSchema} from "@spica-server/bucket/hooks/src/module";
import {BucketService, ServicesModule} from "@spica-server/bucket/services";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {collectionSlugFactory} from "@spica-server/bucket/hooks/src/module";

describe("hook module", () => {
  describe("schema", () => {
    let module: TestingModule;
    let database: DatabaseService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.standalone()]
      }).compile();

      database = module.get(DatabaseService);
    });

    afterEach(async () => {
      await module.close();
    });

    it("should get initial schema", async () => {
      const expectedSchema: any = {
        $id: "http://spica.internal/function/enqueuer/bucket",
        type: "object",
        required: ["bucket", "type"],
        properties: {
          bucket: {
            title: "Bucket",
            type: "string",
            enum: [null],
            viewEnum: [null],
            description: "Bucket id that the event will be tracked on"
          },
          type: {
            title: "Operation type",
            type: "string",
            enum: ["ALL", "INSERT", "UPDATE", "DELETE"],
            description: "Operation type that must be performed in the specified bucket"
          }
        },
        additionalProperties: false
      };

      const schema = await createSchema(database);
      expect(schema).toEqual(expectedSchema);
    });
  });

  describe("factory", () => {
    let bs: BucketService;
    const bucketSchema: any = {
      title: "bucket title",
      properties: {}
    };
    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [
          ServicesModule.initialize(0),
          DatabaseTestingModule.standalone(),
          PreferenceTestingModule
        ]
      }).compile();

      bs = module.get(BucketService);
    });
    it("should return title of bucket", async () => {
      const factory = collectionSlugFactory(bs);
      const bucket = await bs.insertOne(bucketSchema);
      const title = await factory(`bucket_${bucket._id.toHexString()}`);
      expect(title).toEqual("bucket title");
    });
    it("should return the given collection name as is if it's not a bucket collection", async () => {
      const factory = collectionSlugFactory(bs);
      await bs.insertOne(bucketSchema);
      const title = await factory("not_collection_name");
      expect(title).toEqual("not_collection_name");
    });
    it("should return the given collection name as is if bucket not found", async () => {
      const factory = collectionSlugFactory(bs);
      await bs.insertOne(bucketSchema);
      const collName = `bucket_${new ObjectId()}`;
      const title = await factory(collName);
      expect(title).toEqual(collName);
    });
  });
});
