import {AWSS3Strategy} from "../src/strategy/awss3.js";
import * as fs from "fs";

// Shared send mock — must be declared before jest.mock() factory executes.
const sendMock = jest.fn();

// Mock @aws-sdk/client-s3
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({send: sendMock})),
  GetObjectCommand: jest.fn(args => ({type: "get", ...args})),
  PutObjectCommand: jest.fn(args => ({type: "put", ...args})),
  DeleteObjectCommand: jest.fn(args => ({type: "delete", ...args})),
  HeadObjectCommand: jest.fn(args => ({type: "head", ...args}))
}));

describe("AWSS3Strategy", () => {
  let strategy: AWSS3Strategy;
  const credentialsPath = "/tmp/fake-creds.json";
  const bucketName = "test-bucket";
  const credentials = {accessKeyId: "key", secretAccessKey: "secret", region: "us-east-1"};

  beforeEach(() => {
    jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(credentials) as any);
    sendMock.mockReset();
    strategy = new AWSS3Strategy(credentialsPath, bucketName);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
