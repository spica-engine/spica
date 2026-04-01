import {GCloud} from "@spica-server/storage/src/strategy/gcloud";
import {
  Storage,
  Bucket,
  FileOptions,
  SaveOptions,
  DownloadOptions,
  File,
  BucketOptions
} from "@google-cloud/storage";
import {Readable, PassThrough} from "stream";
import {EventEmitter} from "events";

describe("GCloud", () => {
  let service: GCloud;
  let mediaLink;
  const buff = Buffer.alloc(5, "spica");

  const File = {
    download: jest.fn((options?: DownloadOptions) => Promise.resolve([buff])),

    save: jest.fn((data: any, options?: SaveOptions) => Promise.resolve()),

    delete: jest.fn((options?: object) => Promise.resolve()),

    getMetadata: jest.fn((options?: object) => Promise.resolve([{mediaLink}])),

    createWriteStream: jest.fn(() => {
      const writable = new PassThrough();
      setTimeout(() => writable.emit("finish"), 10);
      return writable;
    }),

    move: jest.fn(() => Promise.resolve())
  };

  const Bucket = {
    file: jest.fn((name: string, options?: FileOptions) => File),
    deleteFiles: jest.fn((options?: object) => Promise.resolve()),
    getFiles: jest.fn((options?: object) => Promise.resolve([[], null, {}]))
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

    expect(Bucket.deleteFiles).toHaveBeenCalledTimes(1);
    expect(Bucket.deleteFiles).toHaveBeenCalledWith({prefix: "test_file"});
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

  describe("writeStream", () => {
    it("should pipe readable stream to bucket file write stream", async () => {
      const readable = Readable.from(Buffer.from("stream_data"));
      await service.writeStream("stream_file", readable as any, "text/plain");

      expect(Bucket.file).toHaveBeenCalledWith("stream_file");
      expect(File.createWriteStream).toHaveBeenCalledWith({contentType: "text/plain"});
    });

    it("should reject when write stream emits error", async () => {
      const errorStream = new PassThrough();
      File.createWriteStream.mockReturnValueOnce(errorStream as any);

      const readable = Readable.from(Buffer.from("data"));
      const writePromise = service.writeStream("err_file", readable as any, "text/plain");

      // Emit error directly rather than using destroy, since the GCloud writeStream
      // listens for the 'error' event on the writable stream returned by createWriteStream
      process.nextTick(() => errorStream.emit("error", new Error("write failed")));

      await expect(writePromise).rejects.toThrow("write failed");
    });
  });

  describe("getMetadata", () => {
    it("should return metadata for a file", async () => {
      const metadata = await service.getMetadata("meta_file");

      expect(Bucket.file).toHaveBeenCalledWith("meta_file");
      expect(File.getMetadata).toHaveBeenCalledTimes(1);
      expect(metadata).toEqual({mediaLink});
    });
  });

  describe("rename", () => {
    it("should move files matching the old prefix to the new prefix", async () => {
      const mockFile = {name: "old_prefix/file.txt", move: jest.fn(() => Promise.resolve())};
      Bucket.getFiles.mockResolvedValueOnce([[mockFile]]);

      await service.rename("old_prefix", "new_prefix");

      expect(Bucket.getFiles).toHaveBeenCalledWith({prefix: "old_prefix"});
      expect(mockFile.move).toHaveBeenCalledWith("new_prefix/file.txt");
    });

    it("should handle multiple files during rename", async () => {
      const mockFiles = [
        {name: "dir/a.txt", move: jest.fn(() => Promise.resolve())},
        {name: "dir/b.txt", move: jest.fn(() => Promise.resolve())}
      ];
      Bucket.getFiles.mockResolvedValueOnce([mockFiles]);

      await service.rename("dir", "new_dir");

      expect(mockFiles[0].move).toHaveBeenCalledWith("new_dir/a.txt");
      expect(mockFiles[1].move).toHaveBeenCalledWith("new_dir/b.txt");
    });
  });

  describe("isValidHex32", () => {
    it("should return true for valid 32-char hex strings", () => {
      expect(service.isValidHex32("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6")).toBe(true);
    });

    it("should return false for non-hex strings", () => {
      expect(service.isValidHex32("not-a-hex-string-at-all!!!!!!!!")).toBe(false);
    });

    it("should return false for strings shorter than 32 chars", () => {
      expect(service.isValidHex32("a1b2c3")).toBe(false);
    });

    it("should return false for strings longer than 32 chars", () => {
      expect(service.isValidHex32("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7")).toBe(false);
    });
  });

  describe("getAllFilesMetadataPaginated", () => {
    it("should return files with metadata", async () => {
      const mockFile = {
        name: "test.txt",
        getMetadata: jest.fn(() => Promise.resolve([{contentType: "text/plain"}]))
      };
      Bucket.getFiles.mockResolvedValueOnce([[mockFile], null, {}]);

      const result = await service.getAllFilesMetadataPaginated();

      expect(result.files).toEqual([{name: "test.txt", metadata: {contentType: "text/plain"}}]);
      expect(result.nextPageToken).toBeUndefined();
    });

    it("should pass pageToken when provided", async () => {
      Bucket.getFiles.mockResolvedValueOnce([[], null, {}]);

      await service.getAllFilesMetadataPaginated("token123");

      expect(Bucket.getFiles).toHaveBeenCalledWith({
        maxResults: 100,
        autoPaginate: false,
        pageToken: "token123"
      });
    });

    it("should return nextPageToken when more pages exist", async () => {
      Bucket.getFiles.mockResolvedValueOnce([[], null, {nextPageToken: "next_token"}]);

      const result = await service.getAllFilesMetadataPaginated();

      expect(result.nextPageToken).toEqual("next_token");
    });
  });

  describe("cleanUpExpiredUploadsGCS", () => {
    it("should delete expired TUS uploads with valid hex names", async () => {
      const expiredDate = new Date(Date.now() - 100000).toISOString();
      const mockFile = {
        name: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
        metadata: {
          metadata: {tus_version: "1.0.0"},
          timeCreated: expiredDate
        }
      };

      const deleteSpy = jest.spyOn(service, "delete").mockResolvedValue();
      Bucket.getFiles.mockResolvedValueOnce([[{...mockFile, getMetadata: jest.fn()}], null, {}]);

      jest
        .spyOn(service, "getAllFilesMetadataPaginated")
        .mockResolvedValueOnce({files: [mockFile], nextPageToken: undefined});

      const count = await service.cleanUpExpiredUploadsGCS();

      expect(deleteSpy).toHaveBeenCalledWith("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6");
      expect(count).toBe(1);

      deleteSpy.mockRestore();
    });

    it("should skip files that are not TUS uploads", async () => {
      const mockFile = {
        name: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
        metadata: {
          metadata: {},
          timeCreated: new Date(Date.now() - 100000).toISOString()
        }
      };

      const deleteSpy = jest.spyOn(service, "delete").mockResolvedValue();
      jest
        .spyOn(service, "getAllFilesMetadataPaginated")
        .mockResolvedValueOnce({files: [mockFile], nextPageToken: undefined});

      const count = await service.cleanUpExpiredUploadsGCS();

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(count).toBe(0);

      deleteSpy.mockRestore();
    });

    it("should skip files with non-hex names", async () => {
      const mockFile = {
        name: "regular-filename.txt",
        metadata: {
          metadata: {tus_version: "1.0.0"},
          timeCreated: new Date(Date.now() - 100000).toISOString()
        }
      };

      const deleteSpy = jest.spyOn(service, "delete").mockResolvedValue();
      jest
        .spyOn(service, "getAllFilesMetadataPaginated")
        .mockResolvedValueOnce({files: [mockFile], nextPageToken: undefined});

      const count = await service.cleanUpExpiredUploadsGCS();

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(count).toBe(0);

      deleteSpy.mockRestore();
    });

    it("should skip files that have not expired", async () => {
      const recentDate = new Date().toISOString();
      const mockFile = {
        name: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
        metadata: {
          metadata: {tus_version: "1.0.0"},
          timeCreated: recentDate
        }
      };

      const deleteSpy = jest.spyOn(service, "delete").mockResolvedValue();
      // Use a service with a large expiration so the file is "not expired"
      service["resumableUploadExpiresIn"] = 999999999;
      jest
        .spyOn(service, "getAllFilesMetadataPaginated")
        .mockResolvedValueOnce({files: [mockFile], nextPageToken: undefined});

      const count = await service.cleanUpExpiredUploadsGCS();

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(count).toBe(0);

      deleteSpy.mockRestore();
    });

    it("should paginate through all pages", async () => {
      const expiredDate = new Date(Date.now() - 100000).toISOString();
      const file1 = {
        name: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
        metadata: {metadata: {tus_version: "1.0.0"}, timeCreated: expiredDate}
      };
      const file2 = {
        name: "b1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
        metadata: {metadata: {tus_version: "1.0.0"}, timeCreated: expiredDate}
      };

      const deleteSpy = jest.spyOn(service, "delete").mockResolvedValue();
      const paginateSpy = jest
        .spyOn(service, "getAllFilesMetadataPaginated")
        .mockResolvedValueOnce({files: [file1], nextPageToken: "page2"})
        .mockResolvedValueOnce({files: [file2], nextPageToken: undefined});

      const count = await service.cleanUpExpiredUploadsGCS();

      expect(paginateSpy).toHaveBeenCalledTimes(2);
      expect(deleteSpy).toHaveBeenCalledTimes(2);
      expect(count).toBe(2);

      deleteSpy.mockRestore();
      paginateSpy.mockRestore();
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
