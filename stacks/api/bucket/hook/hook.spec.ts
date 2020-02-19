import {TestingModule, Test} from "@nestjs/testing";
import {hookModuleProviders, SCHEMA} from "@spica-server/bucket/hook/hook.module";
import {ServicesModule} from "@spica-server/bucket/services/bucket.service.module";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PreferenceModule} from "@spica-server/preference";
import {SchemaModule} from "@spica-server/core/schema";
import {BucketService} from "@spica-server/bucket/services/bucket.service";
import {Bucket} from "@spica-server/bucket/services/bucket";

describe("hook module", () => {
  let bucketService: BucketService;
  let module: TestingModule;

  const testBuckets: Bucket[] = [{primary: "b1"}, {primary: "b2"}];

  it("should provide service SCHEMA", async () => {
    module = await Test.createTestingModule({
      imports: [ServicesModule, DatabaseTestingModule.create(), PreferenceModule],
      providers: hookModuleProviders
    }).compile();

    expect(module.get(SCHEMA)).toBeTruthy();
  });
});
