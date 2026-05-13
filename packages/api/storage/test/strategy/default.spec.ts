import {Default} from "@spica-server/storage";
import fs from "fs";
import path from "path";
import {Readable} from "stream";

describe("Default", () => {
  let service: Default;
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(process.env.TEST_TMPDIR, Date.now().toString());
    service = new Default(testDir, "http://insteadof", 0);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, {recursive: true, force: true});
    } catch {}
  });

  it("should create the directory", async () => {
    expect(fs.existsSync(service["path"])).toEqual(true);
  });

  it("should return url", async () => {
    expect(await service.url("test_file")).toEqual("http://insteadof/storage/test_file/view");
  });

  it("should return build path", () => {
    expect(service["buildPath"]("test_file2")).toEqual(`${service["path"]}/test_file2`);
  });

  it("should write and read file", async () => {
    await service.write("file_1", Buffer.from("123"));
    const file = await service.read("file_1");
    expect(file.toString()).toEqual("123");
  });

  it("should delete file", async () => {
    await service.write("file_2", Buffer.from("123"));
    await service.delete("file_2");
    expect(await service.read("file_2").catch(() => "doesnotexist")).toBe("doesnotexist");
  });

  it("should overwrite existing file", async () => {
    await service.write("overwrite_file", Buffer.from("original"));
    await service.write("overwrite_file", Buffer.from("updated"));
    const file = await service.read("overwrite_file");
    expect(file.toString()).toEqual("updated");
  });

  describe("writeStream", () => {
    it("should write file from a readable stream", async () => {
      const readable = Readable.from(Buffer.from("stream_content"));
      await service.writeStream("stream_file", readable as any);
      const file = await service.read("stream_file");
      expect(file.toString()).toEqual("stream_content");
    });

    it("should create a directory when id ends with /", async () => {
      const readable = Readable.from(Buffer.from(""));
      await service.writeStream("my_dir/", readable as any);
      const stat = await fs.promises.stat(path.join(testDir, "my_dir/"));
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe("directory operations", () => {
    it("should create directory on write when id ends with /", async () => {
      await service.write("new_dir/", Buffer.from(""));
      const stat = await fs.promises.stat(path.join(testDir, "new_dir/"));
      expect(stat.isDirectory()).toBe(true);
    });

    it("should remove directory on delete when id ends with /", async () => {
      await service.write("del_dir/", Buffer.from(""));
      expect(fs.existsSync(path.join(testDir, "del_dir/"))).toBe(true);
      await service.delete("del_dir/");
      expect(fs.existsSync(path.join(testDir, "del_dir/"))).toBe(false);
    });
  });

  describe("isDirectory", () => {
    it("should return true for ids ending with /", () => {
      expect(service["isDirectory"]("folder/")).toBe(true);
    });

    it("should return false for ids not ending with /", () => {
      expect(service["isDirectory"]("file.txt")).toBe(false);
    });
  });

  describe("rename", () => {
    it("should rename an existing file", async () => {
      await service.write("old_name", Buffer.from("rename_content"));
      await service.rename("old_name", "new_name");

      const file = await service.read("new_name");
      expect(file.toString()).toEqual("rename_content");

      await expect(service.read("old_name")).rejects.toThrow();
    });

    it("should throw when renaming a non-existent file", async () => {
      await expect(service.rename("nonexistent", "target")).rejects.toMatchObject({code: "ENOENT"});
    });
  });

  describe("ensureStorageDiskExists", () => {
    it("should create storage directory if it does not exist", async () => {
      const freshDir = path.join(process.env.TEST_TMPDIR, `fresh_${Date.now()}`);
      const freshService = new Default(freshDir, "http://insteadof", 0);
      await freshService.write("test", Buffer.from("data"));
      expect(fs.existsSync(freshDir)).toBe(true);
      await fs.promises.rm(freshDir, {recursive: true, force: true});
    });

    it("should not fail if storage directory already exists", async () => {
      await service.write("file_a", Buffer.from("a"));
      await service.write("file_b", Buffer.from("b"));
      const fileB = await service.read("file_b");
      expect(fileB.toString()).toEqual("b");
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

    it("should return 200 with stream and correct headers for an existing file", async () => {
      await service.write("proxy_file", Buffer.from("hello world"));

      const result = await service.proxyRead("proxy_file", {}, meta);

      expect(result.statusCode).toBe(200);
      expect(result.stream).not.toBeNull();
      expect(result.headers["content-type"]).toBe("text/plain");
      expect(result.headers["content-length"]).toBe("11");
      expect(result.headers["etag"]).toBeDefined();
      expect(result.headers["cache-control"]).toBe("public, max-age=3600, must-revalidate");
    });

    it("should return 304 with null stream when if-none-match matches etag", async () => {
      const content = Buffer.from("cached content");
      await service.write("etag_file", content);

      const {headers} = await service.proxyRead("etag_file", {}, meta);
      const eTagValue = headers["etag"];

      const result = await service.proxyRead("etag_file", {"if-none-match": eTagValue}, meta);

      expect(result.statusCode).toBe(304);
      expect(result.stream).toBeNull();
      expect(result.headers["etag"]).toBe(eTagValue);
      expect(result.headers["cache-control"]).toBe("public, max-age=3600, must-revalidate");
    });

    it("should return 200 when if-none-match does not match etag", async () => {
      await service.write("stale_file", Buffer.from("content"));

      const result = await service.proxyRead("stale_file", {"if-none-match": '"stale-etag"'}, meta);

      expect(result.statusCode).toBe(200);
      expect(result.stream).not.toBeNull();
    });

    it("should stream the correct file content", async () => {
      await service.write("streamed_file", Buffer.from("streamed data"));

      const result = await service.proxyRead("streamed_file", {}, meta);

      const chunks: Buffer[] = [];
      for await (const chunk of result.stream!) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString()).toBe("streamed data");
    });

    it("should use content-type from meta", async () => {
      await service.write("typed_file", Buffer.from("data"));
      const imageMeta = {name: "typed_file", content: {type: "image/png"}} as any;

      const result = await service.proxyRead("typed_file", {}, imageMeta);

      expect(result.headers["content-type"]).toBe("image/png");
    });
  });
});
