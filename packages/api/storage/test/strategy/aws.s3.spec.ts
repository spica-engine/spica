import {AWSS3} from "@spica-server/storage";
import {Readable} from "stream";
import fs from "fs";
import path from "path";
import os from "os";

describe("AWSS3", () => {
  let service: AWSS3;
  let sendMock: jest.Mock;
  let credentialsPath: string;

  beforeAll(() => {
    const tmpDir = os.tmpdir();
    credentialsPath = path.join(tmpDir, `aws-test-creds-${Date.now()}.json`);
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify({
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        region: "us-east-1"
      })
    );
  });

  afterAll(() => {
    try {
      fs.unlinkSync(credentialsPath);
    } catch {}
  });

  beforeEach(() => {
    service = new AWSS3(credentialsPath, "test-bucket", 60000);

    sendMock = jest.fn();
    service.s3 = {send: sendMock, config: {region: jest.fn(() => "us-east-1")}} as any;
  });

  describe("constructor", () => {
    it("should initialize s3 client", () => {
      expect(service.s3).toBeDefined();
    });

    it("should store bucket name", () => {
      expect(service["bucketName"]).toEqual("test-bucket");
    });

    it("should store credentials path", () => {
      expect(service["credentialsPath"]).toEqual(credentialsPath);
    });
  });

  describe("getConfig", () => {
    it("should parse and return config from credentials file", () => {
      const config = service.getConfig();
      expect(config).toEqual({
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        region: "us-east-1"
      });
    });
  });

  describe("read", () => {
    it("should read file from S3 and return buffer", async () => {
      const chunks = [Buffer.from("hello"), Buffer.from(" world")];
      const mockStream = new Readable({
        read() {
          const chunk = chunks.shift();
          this.push(chunk || null);
        }
      });

      sendMock.mockResolvedValueOnce({Body: mockStream});

      const result = await service.read("test-file.txt");

      expect(result.toString()).toEqual("hello world");
      expect(sendMock).toHaveBeenCalledTimes(1);

      const command = sendMock.mock.calls[0][0];
      expect(command.input).toEqual({Bucket: "test-bucket", Key: "test-file.txt"});
    });

    it("should reject when stream emits error", async () => {
      const mockStream = new Readable({
        read() {
          this.destroy(new Error("stream error"));
        }
      });

      sendMock.mockResolvedValueOnce({Body: mockStream});

      await expect(service.read("error-file")).rejects.toThrow("stream error");
    });
  });

  describe("write", () => {
    it("should upload buffer to S3 with content type", async () => {
      sendMock.mockResolvedValueOnce({});

      await service.write("upload.txt", Buffer.from("content"), "text/plain");

      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command.input).toEqual({
        Bucket: "test-bucket",
        Key: "upload.txt",
        Body: Buffer.from("content"),
        ContentType: "text/plain"
      });
    });

    it("should upload without content type", async () => {
      sendMock.mockResolvedValueOnce({});

      await service.write("upload.bin", Buffer.from("binary"));

      const command = sendMock.mock.calls[0][0];
      expect(command.input.ContentType).toBeUndefined();
    });
  });

  describe("writeStream", () => {
    it("should delegate to write method", async () => {
      sendMock.mockResolvedValueOnce({});

      const readable = Readable.from(Buffer.from("stream_data"));
      await service.writeStream("stream-file.txt", readable as any, "text/plain");

      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command.input.Key).toEqual("stream-file.txt");
      expect(command.input.ContentType).toEqual("text/plain");
    });
  });

  describe("delete", () => {
    it("should list and delete all objects matching prefix", async () => {
      sendMock
        .mockResolvedValueOnce({
          Contents: [{Key: "folder/file1.txt"}, {Key: "folder/file2.txt"}],
          IsTruncated: false
        })
        .mockResolvedValueOnce({});

      await service.delete("folder/");

      expect(sendMock).toHaveBeenCalledTimes(2);

      const listCommand = sendMock.mock.calls[0][0];
      expect(listCommand.input).toEqual({
        Bucket: "test-bucket",
        Prefix: "folder/",
        ContinuationToken: undefined
      });

      const deleteCommand = sendMock.mock.calls[1][0];
      expect(deleteCommand.input.Bucket).toEqual("test-bucket");
      expect(deleteCommand.input.Delete.Objects).toEqual([
        {Key: "folder/file1.txt"},
        {Key: "folder/file2.txt"}
      ]);
    });

    it("should handle paginated deletion with continuation token", async () => {
      sendMock
        .mockResolvedValueOnce({
          Contents: [{Key: "a.txt"}],
          IsTruncated: true,
          NextContinuationToken: "token2"
        })
        .mockResolvedValueOnce({}) // delete batch 1
        .mockResolvedValueOnce({
          Contents: [{Key: "b.txt"}],
          IsTruncated: false
        })
        .mockResolvedValueOnce({}); // delete batch 2

      await service.delete("prefix");

      expect(sendMock).toHaveBeenCalledTimes(4);
    });

    it("should handle empty contents gracefully", async () => {
      sendMock.mockResolvedValueOnce({
        Contents: undefined,
        IsTruncated: false
      });

      await service.delete("empty/");

      // Only the list call, no delete call
      expect(sendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("url", () => {
    it("should return the S3 public URL", async () => {
      const url = await service.url("my-file.png");
      expect(url).toEqual("https://test-bucket.s3.us-east-1.amazonaws.com/my-file.png");
    });
  });

  describe("rename", () => {
    it("should copy objects to new prefix and delete originals", async () => {
      sendMock
        .mockResolvedValueOnce({
          Contents: [{Key: "old/file.txt"}],
          IsTruncated: false
        })
        .mockResolvedValueOnce({}) // copy
        .mockResolvedValueOnce({}); // delete

      await service.rename("old", "new");

      expect(sendMock).toHaveBeenCalledTimes(3);

      const copyCommand = sendMock.mock.calls[1][0];
      expect(copyCommand.input).toEqual({
        Bucket: "test-bucket",
        CopySource: `test-bucket/${encodeURIComponent("old/file.txt")}`,
        Key: "new/file.txt"
      });

      const deleteCommand = sendMock.mock.calls[2][0];
      expect(deleteCommand.input).toEqual({
        Bucket: "test-bucket",
        Key: "old/file.txt"
      });
    });

    it("should handle multiple files during rename", async () => {
      sendMock
        .mockResolvedValueOnce({
          Contents: [{Key: "old/a.txt"}, {Key: "old/b.txt"}],
          IsTruncated: false
        })
        .mockResolvedValueOnce({}) // copy a
        .mockResolvedValueOnce({}) // delete a
        .mockResolvedValueOnce({}) // copy b
        .mockResolvedValueOnce({}); // delete b

      await service.rename("old", "new");

      // 1 list + 2 copies + 2 deletes = 5
      expect(sendMock).toHaveBeenCalledTimes(5);
    });

    it("should paginate through all objects when renaming", async () => {
      sendMock
        .mockResolvedValueOnce({
          Contents: [{Key: "old/x.txt"}],
          IsTruncated: true,
          NextContinuationToken: "tok"
        })
        .mockResolvedValueOnce({}) // copy
        .mockResolvedValueOnce({}) // delete
        .mockResolvedValueOnce({
          Contents: [{Key: "old/y.txt"}],
          IsTruncated: false
        })
        .mockResolvedValueOnce({}) // copy
        .mockResolvedValueOnce({}); // delete

      await service.rename("old", "new");

      expect(sendMock).toHaveBeenCalledTimes(6);
    });

    it("should handle empty listing gracefully", async () => {
      sendMock.mockResolvedValueOnce({
        Contents: undefined,
        IsTruncated: false
      });

      await service.rename("nonexistent", "target");

      expect(sendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleResumableUpload", () => {
    it("should delegate to tusServer.handle", () => {
      const mockReq = {};
      const mockRes = {};
      const handleSpy = jest
        .spyOn(service["tusServer"], "handle")
        .mockImplementation(async () => {});
      service.handleResumableUpload(mockReq, mockRes);
      expect(handleSpy).toHaveBeenCalledWith(mockReq, mockRes);
      handleSpy.mockRestore();
    });
  });

  describe("resumableUploadFinished", () => {
    it("should return an observable", () => {
      const obs = service.resumableUploadFinished;
      expect(obs).toBeDefined();
      expect(typeof obs.subscribe).toBe("function");
    });
  });

  describe("proxyRead", () => {
    const meta = {name: "test", content: {type: "text/plain"}} as any;

    it("should stream object body and forward response headers", async () => {
      const mockBodyStream = Readable.from(Buffer.from("file content"));
      sendMock.mockResolvedValueOnce({
        $metadata: {httpStatusCode: 200},
        Body: mockBodyStream,
        ContentType: "image/png",
        ContentLength: 12,
        ETag: '"abc123"',
        LastModified: new Date("2024-01-01"),
        CacheControl: "public, max-age=86400",
        AcceptRanges: "bytes"
      });

      const result = await service.proxyRead("image.png", {}, meta);

      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(200);
      expect(result!.stream).toBe(mockBodyStream);
      expect(result!.headers["content-type"]).toBe("image/png");
      expect(result!.headers["content-length"]).toBe("12");
      expect(result!.headers["etag"]).toBe('"abc123"');
      expect(result!.headers["cache-control"]).toBe("public, max-age=86400");
      expect(result!.headers["accept-ranges"]).toBe("bytes");
      const command = sendMock.mock.calls[0][0];
      expect(command.input).toEqual({Bucket: "test-bucket", Key: "image.png"});
    });

    it("should forward if-none-match as IfNoneMatch to S3", async () => {
      const mockBodyStream = Readable.from(Buffer.from("data"));
      sendMock.mockResolvedValueOnce({
        $metadata: {httpStatusCode: 200},
        Body: mockBodyStream
      });

      await service.proxyRead("file.txt", {"if-none-match": '"etag-value"'}, meta);

      const command = sendMock.mock.calls[0][0];
      expect(command.input.IfNoneMatch).toBe('"etag-value"');
    });

    it("should forward range header and return 206 status with content-range", async () => {
      const mockBodyStream = Readable.from(Buffer.from("partial data"));
      sendMock.mockResolvedValueOnce({
        $metadata: {httpStatusCode: 206},
        Body: mockBodyStream,
        ContentRange: "bytes 0-99/1000",
        ContentType: "video/mp4"
      });

      const result = await service.proxyRead("video.mp4", {range: "bytes=0-99"}, meta);

      expect(result!.statusCode).toBe(206);
      expect(result!.headers["content-range"]).toBe("bytes 0-99/1000");
      const command = sendMock.mock.calls[0][0];
      expect(command.input.Range).toBe("bytes=0-99");
    });

    it("should forward if-match, if-modified-since, and if-unmodified-since headers", async () => {
      sendMock.mockResolvedValueOnce({
        $metadata: {httpStatusCode: 200},
        Body: Readable.from(Buffer.from("data"))
      });

      const date = "Mon, 01 Jan 2024 00:00:00 GMT";
      await service.proxyRead("file.txt", {
        "if-match": '"match-etag"',
        "if-modified-since": date,
        "if-unmodified-since": date
      }, meta);

      const command = sendMock.mock.calls[0][0];
      expect(command.input.IfMatch).toBe('"match-etag"');
      expect(command.input.IfModifiedSince).toEqual(new Date(date));
      expect(command.input.IfUnmodifiedSince).toEqual(new Date(date));
    });

    it("should return 304 with null stream when httpStatusCode is 304", async () => {
      sendMock.mockResolvedValueOnce({
        $metadata: {httpStatusCode: 304},
        Body: null
      });

      const result = await service.proxyRead("file.txt", {"if-none-match": '"etag"'}, meta);

      expect(result!.statusCode).toBe(304);
      expect(result!.stream).toBeNull();
    });

    it("should return 304 with null stream when SDK throws a 304 error", async () => {
      const error: any = new Error("Not Modified");
      error.$metadata = {httpStatusCode: 304};
      sendMock.mockRejectedValueOnce(error);

      const result = await service.proxyRead("file.txt", {"if-none-match": '"etag"'}, meta);

      expect(result!.statusCode).toBe(304);
      expect(result!.stream).toBeNull();
    });

    it("should rethrow non-304 S3 errors", async () => {
      const error: any = new Error("Access Denied");
      error.$metadata = {httpStatusCode: 403};
      sendMock.mockRejectedValueOnce(error);

      await expect(service.proxyRead("secret.txt", {}, meta)).rejects.toThrow("Access Denied");
    });

    it("should not include content-length when ContentLength is undefined", async () => {
      sendMock.mockResolvedValueOnce({
        $metadata: {httpStatusCode: 200},
        Body: Readable.from(Buffer.from("data")),
        ContentType: "text/plain"
      });

      const result = await service.proxyRead("file.txt", {}, meta);

      expect(result!.headers["content-length"]).toBeUndefined();
    });

    it("should set last-modified header as UTC string", async () => {
      const lastModified = new Date("2024-06-15T12:00:00Z");
      sendMock.mockResolvedValueOnce({
        $metadata: {httpStatusCode: 200},
        Body: Readable.from(Buffer.from("data")),
        LastModified: lastModified
      });

      const result = await service.proxyRead("file.txt", {}, meta);

      expect(result!.headers["last-modified"]).toBe(lastModified.toUTCString());
    });
  });
});
