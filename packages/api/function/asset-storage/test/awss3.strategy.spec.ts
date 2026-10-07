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

  it("should initialize s3 client with the default credential provider chain when credentials path is not provided", () => {
    const strategyWithoutCredentials = new AWSS3Strategy(undefined, bucketName);
    expect(strategyWithoutCredentials["s3"]).toBeDefined();
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

  it("should upload a file as a stream with its content length", async () => {
    const {mkdtemp, writeFile} = await import("fs/promises");
    const {tmpdir} = await import("os");
    const {join} = await import("path");
    const dir = await mkdtemp(join(tmpdir(), "awss3-upload-"));
    const filePath = join(dir, "archive.tar.gz");
    await writeFile(filePath, "archive");
    sendMock.mockResolvedValueOnce({});

    await strategy.upload("functions/abc/artifacts/x.tar.gz", filePath);

    const input = sendMock.mock.calls[0][0].input;
    expect(input.Key).toBe("functions/abc/artifacts/x.tar.gz");
    expect(input.ContentLength).toBe(7);
  });

  it("should download a file to disk", async () => {
    const {Readable} = await import("stream");
    const {mkdtemp, readFile} = await import("fs/promises");
    const {tmpdir} = await import("os");
    const {join} = await import("path");
    const dir = await mkdtemp(join(tmpdir(), "awss3-download-"));
    const filePath = join(dir, "archive.tar.gz");
    sendMock.mockResolvedValueOnce({Body: Readable.from([Buffer.from("archive")])});

    await strategy.download("functions/abc/artifacts/x.tar.gz", filePath);

    expect((await readFile(filePath)).toString()).toBe("archive");
  });

  it("should list objects across pages", async () => {
    const date = new Date("2026-01-01");
    sendMock
      .mockResolvedValueOnce({
        Contents: [{Key: "functions/abc/artifacts/1.tar.gz", LastModified: date}],
        IsTruncated: true,
        NextContinuationToken: "next"
      })
      .mockResolvedValueOnce({
        Contents: [{Key: "functions/abc/artifacts/2.tar.gz", LastModified: date}],
        IsTruncated: false
      });

    const objects = await strategy.list("functions/abc/artifacts/");

    expect(objects).toEqual([
      {key: "functions/abc/artifacts/1.tar.gz", lastModified: date},
      {key: "functions/abc/artifacts/2.tar.gz", lastModified: date}
    ]);
    expect(sendMock.mock.calls[1][0].input.ContinuationToken).toBe("next");
  });
});
