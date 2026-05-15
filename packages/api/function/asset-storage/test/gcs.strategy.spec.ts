import {GCSStrategy} from "../src/strategy/gcs.js";

// Mock @google-cloud/storage
const fileMock = {
  download: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn()
};
const bucketMock = {file: jest.fn().mockReturnValue(fileMock)};
const storageMock = {bucket: jest.fn().mockReturnValue(bucketMock)};

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => storageMock),
  Bucket: jest.fn()
}));

describe("GCSStrategy", () => {
  let strategy: GCSStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new GCSStrategy("/fake/sa.json", "test-bucket");
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
