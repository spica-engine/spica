import {Test, TestingModule} from "@nestjs/testing";
import {BucketService, ServicesModule} from "@spica-server/bucket-services";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {collectionSlugFactory} from "@spica-server/bucket-hooks/src/module";
import {keyed} from "../../test/support/bucket-app";

contractSuite("hook module", engine => {
  describe("factory", () => {
    let bs: BucketService;
    let module: TestingModule;
    const bucketSchema = (): any => ({
      title: "bucket title",
      description: "bucket description",
      acl: {read: "true==true", write: "true==true"},
      ...keyed(engine, {})
    });

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [ServicesModule.initialize(0), engine.module(), PreferenceTestingModule]
      }).compile();

      bs = module.get(BucketService);
    });

    afterEach(() => module.close());

    it("should return title of bucket", async () => {
      const factory = collectionSlugFactory(bs);
      const bucket = await bs.insert(bucketSchema());
      const title = await factory(`bucket_${bucket._id}`);
      expect(title).toEqual("bucket title");
    });

    it("should return the given collection name as is if it's not a bucket collection", async () => {
      const factory = collectionSlugFactory(bs);
      await bs.insert(bucketSchema());
      const title = await factory("not_collection_name");
      expect(title).toEqual("not_collection_name");
    });

    it("should return the given collection name as is if bucket not found", async () => {
      const factory = collectionSlugFactory(bs);
      await bs.insert(bucketSchema());
      const collName = `bucket_${module.get<IdTypes>(ID_TYPES).unscoped().generate()}`;
      const title = await factory(collName);
      expect(title).toEqual(collName);
    });
  });
});
