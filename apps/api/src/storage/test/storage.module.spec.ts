import {Test} from "@nestjs/testing";
import {StorageModule} from "@spica-server/storage";
import {Strategy} from "@spica-server/storage/src/strategy/strategy";
import {Default} from "@spica-server/storage/src/strategy/default";
import {GCloud} from "@spica-server/storage/src/strategy/gcloud";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";

describe("Strategy", () => {
  it("should create the default strategy", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.standalone(),
        StorageModule.forRoot({
          defaultPath: process.env.TEST_TMPDIR,
          defaultPublicUrl: "http://insteadof",
          strategy: "default",
          objectSizeLimit: 20,
          expirationPeriod: 0
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
          objectSizeLimit: 20,
          expirationPeriod: 0
        })
      ]
    }).compile();

    expect(module.get(Strategy) instanceof GCloud).toBe(true);
  });
});
