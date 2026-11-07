import {Test} from "@nestjs/testing";
import {BucketService, ServicesModule} from "@spica-server/bucket-services";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {collectionSlugFactory} from "@spica-server/bucket-hooks/src/module";

describe("hook module", () => {
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
      const bucket = await bs.insert(bucketSchema);
      const title = await factory(`bucket_${bucket._id.toHexString()}`);
      expect(title).toEqual("bucket title");
    });
    it("should return the given collection name as is if it's not a bucket collection", async () => {
      const factory = collectionSlugFactory(bs);
      await bs.insert(bucketSchema);
      const title = await factory("not_collection_name");
      expect(title).toEqual("not_collection_name");
    });
    it("should return the given collection name as is if bucket not found", async () => {
      const factory = collectionSlugFactory(bs);
      await bs.insert(bucketSchema);
      const collName = `bucket_${new ObjectId()}`;
      const title = await factory(collName);
      expect(title).toEqual(collName);
    });
  });
});
