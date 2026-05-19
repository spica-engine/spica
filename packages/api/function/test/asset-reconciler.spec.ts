import {Test, TestingModule} from "@nestjs/testing";
import {ObjectId} from "@spica-server/database";
import {
  FunctionAssetReconciler,
  hashBuffer,
  assetKey
} from "@spica-server/function/src/asset-reconciler";
import {FunctionAssetService} from "@spica-server/function-services";
import {
  FUNCTION_ASSET_STRATEGY,
  FUNCTION_ASSET_STORAGE_OPTIONS
} from "@spica-server/interface-function-asset-storage";
import {FUNCTION_OPTIONS} from "@spica-server/interface-function";
import {FunctionPreparationService} from "@spica-server/function/src/function-preparation.service";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("hashBuffer", () => {
  it("should return a hex sha256 hash", () => {
    const h = hashBuffer(Buffer.from("hello"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should return the same hash for the same input", () => {
    const buf = Buffer.from("deterministic");
    expect(hashBuffer(buf)).toBe(hashBuffer(buf));
  });
});

describe("assetKey", () => {
  it("should format as functions/<name>/<filename>", () => {
    expect(assetKey("myFunc", "index.ts")).toBe("functions/myFunc/index.ts");
  });
});

describe("FunctionAssetReconciler", () => {
  let module: TestingModule;
  let reconciler: FunctionAssetReconciler;
  let tmpDir: string;

  const mockStrategy = {
    read: jest.fn(),
    write: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn()
  };

  const mockAssetService = {
    findByFunction: jest.fn(),
    upsertAsset: jest.fn(),
    upsertMany: jest.fn(),
    deleteByFunction: jest.fn()
  };

  const mockPreparationService = {
    prepare: jest.fn().mockResolvedValue(undefined)
  };

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconciler-test-"));

    module = await Test.createTestingModule({
      providers: [
        FunctionAssetReconciler,
        {provide: FUNCTION_ASSET_STRATEGY, useValue: mockStrategy},
        {
          provide: FUNCTION_ASSET_STORAGE_OPTIONS,
          useValue: {strategy: "default", defaultPath: tmpDir}
        },
        {provide: FunctionAssetService, useValue: mockAssetService},
        {
          provide: FUNCTION_OPTIONS,
          useValue: {root: tmpDir, timeout: 60, outDir: ".build"}
        },
        {provide: FunctionPreparationService, useValue: mockPreparationService}
      ]
    }).compile();

    reconciler = module.get(FunctionAssetReconciler);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, {recursive: true, force: true});
    await module.close();
  });

  const makeFn = (name = "my-fn") => ({
    _id: new ObjectId(),
    name,
    language: "typescript" as any
  });

  describe("readLocalAsset", () => {
    it("should return buffer + hash when file exists", async () => {
      const fn = makeFn();
      const dir = path.join(tmpDir, fn.name);
      await fs.promises.mkdir(dir, {recursive: true});
      await fs.promises.writeFile(path.join(dir, "index.ts"), "code");

      const result = await reconciler.readLocalAsset(fn as any, "index.ts");
      expect(result).not.toBeNull();
      expect(result!.buffer.toString()).toBe("code");
      expect(result!.hash).toBe(hashBuffer(Buffer.from("code")));
    });

    it("should return null when file does not exist", async () => {
      const fn = makeFn();
      const result = await reconciler.readLocalAsset(fn as any, "index.ts");
      expect(result).toBeNull();
    });
  });

  describe("writeLocalAsset", () => {
    it("should create parent directories and write file", async () => {
      const fn = makeFn("write-fn");
      await reconciler.writeLocalAsset(fn as any, "index.ts", Buffer.from("written"));

      const onDisk = await fs.promises.readFile(path.join(tmpDir, fn.name, "index.ts"), "utf-8");
      expect(onDisk).toBe("written");
    });
  });

  describe("reconcileFunction", () => {
    it("should return false and skip when no stored assets", async () => {
      mockAssetService.findByFunction.mockResolvedValueOnce([]);
      const fn = makeFn();
      const changed = await reconciler.reconcileFunction(fn as any);
      expect(changed).toBe(false);
      expect(mockStrategy.read).not.toHaveBeenCalled();
    });

    it("should skip download when hash matches", async () => {
      const fn = makeFn();
      const data = Buffer.from("matching");
      const hash = hashBuffer(data);

      // Write file with matching hash to disk
      const dir = path.join(tmpDir, fn.name);
      await fs.promises.mkdir(dir, {recursive: true});
      await fs.promises.writeFile(path.join(dir, "index.ts"), data);

      mockAssetService.findByFunction.mockResolvedValueOnce([
        {filename: "index.ts", key: "functions/x/index.ts", hash, strategy: "default"}
      ]);

      const changed = await reconciler.reconcileFunction(fn as any);
      expect(changed).toBe(false);
      expect(mockStrategy.read).not.toHaveBeenCalled();
    });

    it("should download and restore when hash mismatches", async () => {
      const fn = makeFn();
      const remoteData = Buffer.from("remote-content");
      mockStrategy.read.mockResolvedValueOnce(remoteData);

      // Put a different file on disk
      const dir = path.join(tmpDir, fn.name);
      await fs.promises.mkdir(dir, {recursive: true});
      await fs.promises.writeFile(path.join(dir, "index.ts"), "stale");

      mockAssetService.findByFunction.mockResolvedValueOnce([
        {
          filename: "index.ts",
          key: "functions/x/index.ts",
          hash: hashBuffer(remoteData),
          strategy: "default"
        }
      ]);

      const changed = await reconciler.reconcileFunction(fn as any);
      expect(changed).toBe(true);
      expect(mockStrategy.read).toHaveBeenCalledWith("functions/x/index.ts");

      const onDisk = await fs.promises.readFile(path.join(tmpDir, fn.name, "index.ts"));
      expect(onDisk).toEqual(remoteData);
    });

    it("should download when file is missing locally", async () => {
      const fn = makeFn();
      const remoteData = Buffer.from("new-content");
      mockStrategy.read.mockResolvedValueOnce(remoteData);

      mockAssetService.findByFunction.mockResolvedValueOnce([
        {
          filename: "index.ts",
          key: "functions/x/index.ts",
          hash: hashBuffer(remoteData),
          strategy: "default"
        }
      ]);

      const changed = await reconciler.reconcileFunction(fn as any);
      expect(changed).toBe(true);

      const onDisk = await fs.promises.readFile(path.join(tmpDir, fn.name, "index.ts"));
      expect(onDisk).toEqual(remoteData);
    });
  });

  describe("reconcileAll", () => {
    it("should call prepare for functions that changed", async () => {
      const fn = makeFn();
      const remoteData = Buffer.from("data");
      mockStrategy.read.mockResolvedValueOnce(remoteData);
      mockAssetService.findByFunction.mockResolvedValueOnce([
        {
          filename: "index.ts",
          key: "functions/x/index.ts",
          hash: hashBuffer(remoteData),
          strategy: "default"
        }
      ]);

      await reconciler.reconcileAll([fn as any]);
      expect(mockPreparationService.prepare).toHaveBeenCalledWith(fn);
    });

    it("should not call prepare when nothing changed", async () => {
      const fn = makeFn();
      mockAssetService.findByFunction.mockResolvedValueOnce([]);

      await reconciler.reconcileAll([fn as any]);
      expect(mockPreparationService.prepare).not.toHaveBeenCalled();
    });
  });

  describe("snapshotAssets", () => {
    it("should return a map of key to buffer for each asset in storage", async () => {
      const buf = Buffer.from("snapshot-content");
      mockStrategy.read.mockResolvedValueOnce(buf);

      const result = await reconciler.snapshotAssets([{key: "functions/my-fn/index.ts"}]);

      expect(result.get("functions/my-fn/index.ts")).toEqual(buf);
    });

    it("should silently skip keys missing from storage", async () => {
      mockStrategy.read.mockRejectedValueOnce(new Error("not found"));

      const result = await reconciler.snapshotAssets([{key: "functions/my-fn/index.ts"}]);

      expect(result.size).toBe(0);
    });
  });

  describe("rollbackDisk", () => {
    it("should prepare after restoring when prevAssets is non-empty", async () => {
      const fn = makeFn();
      mockStrategy.read.mockResolvedValue(Buffer.from("old"));

      await reconciler.rollbackDisk(fn as any, [
        {key: "functions/my-fn/index.ts", filename: "index.ts" as any}
      ]);

      expect(mockPreparationService.prepare).toHaveBeenCalledWith(fn);
    });

    it("should skip prepare when prevAssets is empty", async () => {
      const fn = makeFn();

      await reconciler.rollbackDisk(fn as any, []);

      expect(mockPreparationService.prepare).not.toHaveBeenCalled();
    });
  });

  describe("rollback", () => {
    it("should re-upload old buffer for pre-existing storage keys", async () => {
      const fn = makeFn();
      const oldBuf = Buffer.from("old-code");
      const prevBuffers = new Map([["functions/my-fn/index.ts", oldBuf]]);

      // restoreAssets (called by rollbackDisk) reads from storage
      mockStrategy.read.mockResolvedValue(oldBuf);
      mockStrategy.write.mockResolvedValue(undefined);

      await reconciler.rollback(
        fn as any,
        [{key: "functions/my-fn/index.ts", filename: "index.ts" as any}],
        ["functions/my-fn/index.ts"],
        prevBuffers
      );

      expect(mockStrategy.write).toHaveBeenCalledWith("functions/my-fn/index.ts", oldBuf);
    });

    it("should delete new storage keys that were not in prevBuffers", async () => {
      const fn = makeFn();
      const prevBuffers = new Map<string, Buffer>(); // empty — key was new

      await reconciler.rollback(fn as any, [], ["functions/my-fn/index.ts"], prevBuffers);

      expect(mockStrategy.delete).toHaveBeenCalledWith("functions/my-fn/index.ts");
    });
  });

  describe("deleteAll", () => {
    it("should delete all remote assets and metadata for a function", async () => {
      const fn = makeFn();
      mockAssetService.findByFunction.mockResolvedValueOnce([
        {key: "functions/my-fn/index.ts"},
        {key: "functions/my-fn/package.json"}
      ]);

      await reconciler.deleteAll(fn as any);

      expect(mockStrategy.delete).toHaveBeenCalledTimes(2);
      expect(mockAssetService.deleteByFunction).toHaveBeenCalledWith(fn._id);
    });
  });
});
