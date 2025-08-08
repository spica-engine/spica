import {GCloud} from "../../src/strategy/gcloud";
import {
  Storage,
  Bucket,
  FileOptions,
  SaveOptions,
  DownloadOptions,
  File,
  BucketOptions
} from "@google-cloud/storage";

describe("GCloud", () => {
  let service: GCloud;
  let mediaLink;
  const buff = Buffer.alloc(5, "spica");

  const File = {
    download: jest.fn((options?: DownloadOptions) => Promise.resolve([buff])),

    save: jest.fn((data: any, options?: SaveOptions) => Promise.resolve()),

    delete: jest.fn((options?: object) => Promise.resolve()),

    getMetadata: jest.fn((options?: object) => Promise.resolve([{mediaLink}]))
  };

  const Bucket = {
    file: jest.fn((name: string, options?: FileOptions) => File)
  };

  beforeEach(() => {
    mediaLink = "http://insteadof?generation=123123";

    service = new GCloud("test_path", "test_bucket", 0);

    //@ts-ignore
    service["bucket"] = Bucket;
  });

  afterEach(() => {
    for (const spy of Object.values({...File, ...Bucket})) {
      spy.mockClear();
    }
  });

  it("should set bucket, storage and environment variable", async () => {
    expect(service["storage"]).toBeDefined();
    expect(service["bucket"]).toBeDefined();
    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toEqual("test_path");
  });

  it("should write file", async () => {
    await service.write("test_file", buff, "text/plain");

    expect(Bucket.file).toHaveBeenCalledTimes(1);
    expect(Bucket.file).toHaveBeenCalledWith("test_file");

    expect(File.save).toHaveBeenCalledTimes(1);
    expect(File.save).toHaveBeenCalledWith(buff, {contentType: "text/plain"});
  });

  it("should read file", async () => {
    const file = await service.read("test_file");

    expect(file.toString()).toEqual("spica");

    expect(Bucket.file).toHaveBeenCalledTimes(1);
    expect(Bucket.file).toHaveBeenCalledWith("test_file");

    expect(File.download).toHaveBeenCalledTimes(1);
  });

  it("should delete file", async () => {
    await service.delete("test_file");

    expect(Bucket.file).toHaveBeenCalledTimes(1);
    expect(Bucket.file).toHaveBeenCalledWith("test_file");

    expect(File.delete).toHaveBeenCalledTimes(1);
  });

  it("should get url without generation param", async () => {
    const url = await service.url("test_file");

    expect(Bucket.file).toHaveBeenCalledTimes(1);
    expect(Bucket.file).toHaveBeenCalledWith("test_file");

    expect(File.getMetadata).toHaveBeenCalledTimes(1);

    expect(url).toEqual("http://insteadof/");
  });

  it("should get url even if it has no generation param", async () => {
    mediaLink = "http://insteadof";

    const url = await service.url("test_file");

    expect(url).toEqual("http://insteadof/");
  });
});
