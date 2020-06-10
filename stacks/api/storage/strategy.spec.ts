import {factoryProvider, GCloud, Default} from "./strategy";
import * as fs from "fs";

describe("Strategy", () => {
  describe("factory provider", () => {
    it("should create default service", () => {
      const service = factoryProvider({
        path: "",
        publicUrl: "test",
        strategy: "default"
      });
      expect(service instanceof Default).toEqual(true);
    });

    it("should create gcloud service", () => {
      const service = factoryProvider({
        path: "",
        publicUrl: "test",
        strategy: "gcloud",
        gcloudBucketName: "test_bucket",
        gcloudServiceAccountPath: "test_accoun_path"
      });
      expect(service instanceof GCloud).toEqual(true);
    });
  });

  describe("default", () => {
    let service: Default;
    beforeAll(() => {
      service = new Default("", "test_url");
    });

    it("should create file directory", () => {
      expect(fs.existsSync(service.path)).toEqual(true);
    });

    it("should return url", () => {
      expect(service.url("test_file")).toEqual("test_url/storage/test_file");
    });

    it("should return build path", () => {
      expect(service.buildPath("test_file2")).toEqual(`${service.path}/test_file2.storageobj`);
    });

    it("should write and read file", async () => {
      await service.write("file_1", "123");
      const file = await service.read("file_1");
      expect(file.toString()).toEqual("123");
    });

    it("should delete file", async () => {
      await service.delete("file_2");
      const file = service.read("file_2");
      expect(file).toEqual(undefined);
    });
  });

  describe("gcloud", () => {
    let service: GCloud;

    beforeAll(() => {
      service = new GCloud("test_path", "test_bucket");
    });

    it("should set bucket, storage and environment variable", () => {
      expect(service.storage).toBeDefined();
      expect(service.bucket).toBeDefined();
      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toEqual("test_path");
    });
  });
});
