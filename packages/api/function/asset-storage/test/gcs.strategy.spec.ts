import {GCSStrategy} from "../src/strategy/gcs.js";
import {Storage} from "@google-cloud/storage";

describe("GCSStrategy", () => {
  let strategy: GCSStrategy;
  let fileMock: {download: jest.Mock; save: jest.Mock; delete: jest.Mock; exists: jest.Mock};
  let bucketMock: {file: jest.Mock};

  beforeEach(() => {
    fileMock = {download: jest.fn(), save: jest.fn(), delete: jest.fn(), exists: jest.fn()};
    bucketMock = {file: jest.fn().mockReturnValue(fileMock)};
    const mockStorage = {bucket: jest.fn().mockReturnValue(bucketMock)} as unknown as Storage;
    strategy = new GCSStrategy("/fake/sa.json", "test-bucket", mockStorage);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should read a file", async () => {
    fileMock.download.mockResolvedValueOnce([Buffer.from("hello")]);
    const result = await strategy.read("functions/abc/index.ts");
    expect(result.toString()).toBe("hello");
  });

  it("should write a file", async () => {
    fileMock.save.mockResolvedValueOnce(undefined);
    await strategy.write("functions/abc/index.ts", Buffer.from("data"));
    expect(fileMock.save).toHaveBeenCalledWith(Buffer.from("data"));
  });

  it("should delete a file", async () => {
    fileMock.delete.mockResolvedValueOnce(undefined);
    await strategy.delete("functions/abc/index.ts");
    expect(fileMock.delete).toHaveBeenCalledTimes(1);
  });

  it("should not throw when deleting a non-existent file (404)", async () => {
    fileMock.delete.mockRejectedValueOnce({code: 404});
    await expect(strategy.delete("functions/abc/missing.ts")).resolves.not.toThrow();
  });

  it("should return true when file exists", async () => {
    fileMock.exists.mockResolvedValueOnce([true]);
    expect(await strategy.exists("functions/abc/index.ts")).toBe(true);
  });

  it("should return false when file does not exist", async () => {
    fileMock.exists.mockResolvedValueOnce([false]);
    expect(await strategy.exists("functions/abc/missing.ts")).toBe(false);
  });
});

