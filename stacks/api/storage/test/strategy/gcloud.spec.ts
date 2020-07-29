import {GCloud} from "@spica-server/storage/src/strategy/gcloud";

describe("GCloud", () => {
  let service: GCloud;

  beforeEach(() => {
    service = new GCloud("test_path", "test_bucket");
  });

  it("should set bucket, storage and environment variable", () => {
    expect(service["storage"]).toBeDefined();
    expect(service["bucket"]).toBeDefined();
    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toEqual("test_path");
  });
});
