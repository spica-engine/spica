import {Test} from "@nestjs/testing";
import {StorageModule} from "..";
import {Strategy} from "../src/strategy/strategy";
import {Default} from "../src/strategy/default";
import {GCloud} from "../src/strategy/gcloud";
import {DatabaseTestingModule} from "../../../../../libs/database/testing";
import {PassportTestingModule} from "../../passport/testing";

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
          resumableUploadExpiresIn: 0
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
          resumableUploadExpiresIn: 0
        })
      ]
    }).compile();

    expect(module.get(Strategy) instanceof GCloud).toBe(true);
  });
});
