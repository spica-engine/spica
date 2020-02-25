import {Test, TestingModule} from "@nestjs/testing";
import {hookModuleProviders} from "@spica-server/bucket/hooks";
import {Bucket, ServicesModule} from "@spica-server/bucket/services";
import {BucketService} from "@spica-server/bucket/services/bucket.service";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {SCHEMA} from "@spica-server/function";

import {PreferenceModule} from "@spica-server/preference";

class MockBucketService extends BucketService {
  find(filter?: any): Promise<Bucket[]> {
    return new Promise(resolve =>
      resolve([
        {primary: "primary_1", _id: new ObjectId("5e4e8320a28c2f494c588aea")},
        {primary: "primary_2", _id: new ObjectId("5e4e8320a28c2f494c588aeb")}
      ])
    );
  }
}

describe("hook module", () => {
  describe("schema", () => {
    let module: TestingModule;
    beforeAll(async () => {
      module = await Test.createTestingModule({
        imports: [ServicesModule, DatabaseTestingModule.create(), PreferenceModule],
        providers: hookModuleProviders
      })
        .overrideProvider(BucketService)
        .useClass(MockBucketService)
        .compile();
    });

    it("should get bucket schema with name", async () => {
      const schemaWithName = module.get(SCHEMA);
      expect(schemaWithName.name).toEqual("bucket");
      const schema = await schemaWithName.schema();
      expect(schema).toEqual({
        $id: "http://spica.internal/function/enqueuer/bucket",
        type: "object",
        required: ["bucket", "type"],
        properties: {
          bucket: {
            title: "Bucket ID",
            type: "string",
            enum: ["5e4e8320a28c2f494c588aea", "5e4e8320a28c2f494c588aeb"]
          },
          type: {
            title: "Operation type",
            description: "Event Type",
            type: "string",
            enum: ["INSERT", "INDEX", "GET", "UPDATE"]
          }
        },
        additionalProperties: false
      });
    });
  });
});
