import {Test} from "@nestjs/testing";
import {StorageModule} from "@spica/api/src/storage";
import {Strategy} from "@spica/api/src/storage/src/strategy/strategy";
import {Default} from "@spica/api/src/storage/src/strategy/default";
import {GCloud} from "@spica/api/src/storage/src/strategy/gcloud";
import {DatabaseTestingModule} from "@spica/database";
import {PassportTestingModule} from "@spica/api/src/passport/testing";

describe("Strategy", () => {
  it("should create the default strategy", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.standalone(),
        StorageModule.forRoot({
          defaultPath: undefined,
          defaultPublicUrl: undefined,
          strategy: "default",
          objectSizeLimit: 20
        })
      ]
    }).compile();

    expect(module.get(Strategy) instanceof Default).toBe(true);
  });

  it("should create the gcloud strategy", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.standalone(),
        StorageModule.forRoot({
          strategy: "gcloud",
          gcloudBucketName: "test",
          gcloudServiceAccountPath: process.env.TEST_TMPDIR,
          objectSizeLimit: 20
        })
      ]
    }).compile();

    expect(module.get(Strategy) instanceof GCloud).toBe(true);
  });
});
