import {AWSS3Strategy} from "../src/strategy/awss3.js";
import {S3Client} from "@aws-sdk/client-s3";

describe("AWSS3Strategy", () => {
  let strategy: AWSS3Strategy;
  let sendMock: jest.Mock;
  const bucketName = "test-bucket";
  const credentials = {accessKeyId: "key", secretAccessKey: "secret", region: "us-east-1"};

  beforeEach(() => {
    sendMock = jest.fn();
    const mockClient = {send: sendMock} as unknown as S3Client;
    strategy = new AWSS3Strategy("/fake/creds.json", bucketName, mockClient);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should read a file by streaming body", async () => {
    const {Readable} = await import("stream");
    const fakeBody = Readable.from([Buffer.from("content")]);
    sendMock.mockResolvedValueOnce({Body: fakeBody});

    const result = await strategy.read("functions/abc/index.ts");
    expect(result.toString()).toBe("content");
  });

  it("should write a file", async () => {
    sendMock.mockResolvedValueOnce({});
    await strategy.write("functions/abc/index.ts", Buffer.from("data"));
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("should delete a file", async () => {
    sendMock.mockResolvedValueOnce({});
    await strategy.delete("functions/abc/index.ts");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("should return true when file exists", async () => {
    sendMock.mockResolvedValueOnce({});
    expect(await strategy.exists("functions/abc/index.ts")).toBe(true);
  });

  it("should return false when file does not exist", async () => {
    sendMock.mockRejectedValueOnce({name: "NotFound"});
    expect(await strategy.exists("functions/abc/missing.ts")).toBe(false);
  });
});
