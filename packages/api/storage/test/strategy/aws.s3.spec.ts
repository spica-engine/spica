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
});
