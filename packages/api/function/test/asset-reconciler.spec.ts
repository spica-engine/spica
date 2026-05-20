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
import {FunctionPreparationService} from "@spica-server/function/src/function-preparation.service";

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
    prepare: jest.fn().mockResolvedValue(undefined),
    readFileBuffer: jest.fn().mockResolvedValue(null),
    writeFileBuffer: jest.fn().mockResolvedValue(undefined),
    prepareIndex: jest.fn().mockResolvedValue(undefined),
    preparePackageJson: jest.fn().mockResolvedValue(undefined)
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        FunctionAssetReconciler,
        {provide: FUNCTION_ASSET_STRATEGY, useValue: mockStrategy},
        {
          provide: FUNCTION_ASSET_STORAGE_OPTIONS,
          useValue: {strategy: "default", defaultPath: "/tmp"}
        },
        {provide: FunctionAssetService, useValue: mockAssetService},
        {provide: FunctionPreparationService, useValue: mockPreparationService}
      ]
    }).compile();

    reconciler = module.get(FunctionAssetReconciler);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await module.close();
  });

  const makeFn = (name = "my-fn") => ({
    _id: new ObjectId(),
    name,
    language: "typescript" as any
  });

  describe("reconcileFunction", () => {
    it("should skip reconciliation when no stored assets", async () => {
      mockAssetService.findByFunction.mockResolvedValueOnce([]);
      const fn = makeFn();
      await reconciler.reconcileFunction(fn as any);
      expect(mockStrategy.read).not.toHaveBeenCalled();
      expect(mockPreparationService.prepare).not.toHaveBeenCalled();
    });

    it("should skip download when hash matches", async () => {
      const fn = makeFn();
      const data = Buffer.from("matching");
      const hash = hashBuffer(data);

      mockPreparationService.readFileBuffer.mockResolvedValueOnce(data);
      mockAssetService.findByFunction.mockResolvedValueOnce([
        {filename: "index.ts", key: "functions/x/index.ts", hash, strategy: "default"}
      ]);

      await reconciler.reconcileFunction(fn as any);
      expect(mockStrategy.read).not.toHaveBeenCalled();
      expect(mockPreparationService.prepare).not.toHaveBeenCalled();
    });

    it("should download and restore when hash mismatches", async () => {
      const fn = makeFn();
      const remoteData = Buffer.from("remote-content");
      const staleData = Buffer.from("stale");

      mockPreparationService.readFileBuffer.mockResolvedValueOnce(staleData);
      mockStrategy.read.mockResolvedValueOnce(remoteData);
      mockAssetService.findByFunction.mockResolvedValueOnce([
        {
          filename: "index.ts",
          key: "functions/x/index.ts",
          hash: hashBuffer(remoteData),
          strategy: "default"
        }
      ]);

      await reconciler.reconcileFunction(fn as any);
      expect(mockStrategy.read).toHaveBeenCalledWith("functions/x/index.ts");
      expect(mockPreparationService.writeFileBuffer).toHaveBeenCalledWith(
        fn,
        "index.ts",
        remoteData
      );
      expect(mockPreparationService.prepare).toHaveBeenCalledWith(fn);
    });

    it("should download when file is missing locally", async () => {
      const fn = makeFn();
      const remoteData = Buffer.from("new-content");

      mockPreparationService.readFileBuffer.mockResolvedValueOnce(null);
      mockStrategy.read.mockResolvedValueOnce(remoteData);
      mockAssetService.findByFunction.mockResolvedValueOnce([
        {
          filename: "index.ts",
          key: "functions/x/index.ts",
          hash: hashBuffer(remoteData),
          strategy: "default"
        }
      ]);

      await reconciler.reconcileFunction(fn as any);
      expect(mockPreparationService.writeFileBuffer).toHaveBeenCalledWith(
        fn,
        "index.ts",
        remoteData
      );
      expect(mockPreparationService.prepare).toHaveBeenCalledWith(fn);
    });
  });

  describe("reconcileAll", () => {
    it("should call prepare for functions that changed", async () => {
      const fn = makeFn();
      const remoteData = Buffer.from("data");

      mockPreparationService.readFileBuffer.mockResolvedValueOnce(null);
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

  describe("snapshotAsset", () => {
    it("should return the buffer for an existing asset", async () => {
      const buf = Buffer.from("snapshot-content");
      mockStrategy.read.mockResolvedValueOnce(buf);

      const result = await reconciler.snapshotAsset({key: "functions/my-fn/index.ts"});

      expect(result).toEqual(buf);
    });

    it("should return null when key is missing from storage", async () => {
      mockStrategy.read.mockRejectedValueOnce(new Error("not found"));

      const result = await reconciler.snapshotAsset({key: "functions/my-fn/index.ts"});

      expect(result).toBeNull();
    });

    it("should return null when prevAsset is null", async () => {
      const result = await reconciler.snapshotAsset(null);

      expect(result).toBeNull();
      expect(mockStrategy.read).not.toHaveBeenCalled();
    });
  });

  describe("rollbackDisk", () => {
    it("should restore and call prepareIndex for index.ts", async () => {
      const fn = makeFn();
      const oldBuf = Buffer.from("old");
      mockStrategy.read.mockResolvedValueOnce(oldBuf);

      await reconciler.rollbackDisk(fn as any, {
        key: "functions/my-fn/index.ts",
        filename: "index.ts"
      });

      expect(mockPreparationService.writeFileBuffer).toHaveBeenCalledWith(fn, "index.ts", oldBuf);
      expect(mockPreparationService.prepareIndex).toHaveBeenCalledWith(fn);
    });

    it("should restore and call prepareIndex for index.mjs", async () => {
      const fn = makeFn();
      const oldBuf = Buffer.from("old");
      mockStrategy.read.mockResolvedValueOnce(oldBuf);

      await reconciler.rollbackDisk(fn as any, {
        key: "functions/my-fn/index.mjs",
        filename: "index.mjs"
      });

      expect(mockPreparationService.prepareIndex).toHaveBeenCalledWith(fn);
    });

    it("should restore and call preparePackageJson for package.json", async () => {
      const fn = makeFn();
      const oldBuf = Buffer.from("{}");
      mockStrategy.read.mockResolvedValueOnce(oldBuf);

      await reconciler.rollbackDisk(fn as any, {
        key: "functions/my-fn/package.json",
        filename: "package.json"
      });

      expect(mockPreparationService.writeFileBuffer).toHaveBeenCalledWith(
        fn,
        "package.json",
        oldBuf
      );
      expect(mockPreparationService.preparePackageJson).toHaveBeenCalledWith(fn);
    });

    it("should skip prepare when prevAsset is null", async () => {
      const fn = makeFn();

      await reconciler.rollbackDisk(fn as any, null);

      expect(mockPreparationService.prepareIndex).not.toHaveBeenCalled();
      expect(mockPreparationService.preparePackageJson).not.toHaveBeenCalled();
    });
  });

  describe("rollback", () => {
    it("should re-upload old buffer for pre-existing storage key", async () => {
      const fn = makeFn();
      const oldBuf = Buffer.from("old-code");

      mockStrategy.read.mockResolvedValue(oldBuf);
      mockStrategy.write.mockResolvedValue(undefined);

      await reconciler.rollback(
        fn as any,
        {key: "functions/my-fn/index.ts", filename: "index.ts"},
        "functions/my-fn/index.ts",
        oldBuf
      );

      expect(mockStrategy.write).toHaveBeenCalledWith("functions/my-fn/index.ts", oldBuf);
    });

    it("should delete the uploaded key when prevBuffer is null (new file)", async () => {
      const fn = makeFn();

      await reconciler.rollback(fn as any, null, "functions/my-fn/index.ts", null);

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
