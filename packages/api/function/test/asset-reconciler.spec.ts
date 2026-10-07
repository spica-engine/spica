import {ObjectId} from "@spica-server/database";
import {
  FunctionAssetReconciler,
  hashBuffer,
  assetKey
} from "@spica-server/function/src/asset-reconciler";
import {
  FUNCTION_ASSET_STRATEGY,
  FUNCTION_ASSET_STORAGE_OPTIONS
} from "@spica-server/interface-function-asset-storage";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockFn = {
  _id: new ObjectId(),
  name: "my-function",
  language: "typescript",
  timeout: 30,
  triggers: {},
  env: {}
} as any;

const buildReconciler = (overrides: Partial<typeof mockDeps> = {}) => {
  const merged = {...mockDeps, ...overrides};
  const reconciler = new FunctionAssetReconciler(
    merged.strategy as any,
    merged.storageOptions as any,
    merged.assetService as any,
    merged.preparationService as any,
    merged.tracker as any
  );
  // Inject tokens manually (NestJS @Inject decorators are metadata; for pure unit
  // tests we patch the private members directly after construction).
  (reconciler as any).strategy = merged.strategy;
  (reconciler as any).storageOptions = merged.storageOptions;
  (reconciler as any).assetService = merged.assetService;
  (reconciler as any).preparationService = merged.preparationService;
  (reconciler as any).tracker = merged.tracker;
  return reconciler;
};

let mockDeps: {
  strategy: jest.Mocked<{
    read: jest.Mock;
    write: jest.Mock;
    delete: jest.Mock;
    exists: jest.Mock;
  }>;
  storageOptions: {strategy: string};
  assetService: jest.Mocked<{
    findByFunction: jest.Mock;
    findByFilename: jest.Mock;
    upsertAsset: jest.Mock;
    deleteByFunction: jest.Mock;
  }>;
  preparationService: jest.Mocked<{
    prepare: jest.Mock;
    prepareIndex: jest.Mock;
    preparePackageJson: jest.Mock;
    readFileBuffer: jest.Mock;
    writeFileBuffer: jest.Mock;
    indexFilename: jest.Mock;
  }>;
  tracker: {stamp: jest.Mock};
};

beforeEach(() => {
  mockDeps = {
    strategy: {
      read: jest.fn().mockResolvedValue(Buffer.from("remote")),
      write: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true)
    },
    storageOptions: {strategy: "default"},
    assetService: {
      findByFunction: jest.fn().mockResolvedValue([]),
      findByFilename: jest.fn().mockResolvedValue(null),
      upsertAsset: jest.fn().mockResolvedValue(undefined),
      deleteByFunction: jest.fn().mockResolvedValue(1)
    },
    preparationService: {
      prepare: jest.fn().mockResolvedValue(undefined),
      prepareIndex: jest.fn().mockResolvedValue(undefined),
      preparePackageJson: jest.fn().mockResolvedValue(undefined),
      readFileBuffer: jest.fn().mockResolvedValue(null),
      writeFileBuffer: jest.fn().mockResolvedValue(undefined),
      indexFilename: jest.fn().mockReturnValue("index.ts")
    },
    tracker: {stamp: jest.fn()}
  };
});

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

describe("hashBuffer", () => {
  it("should return a consistent sha256 hex string for a given buffer", () => {
    const buf = Buffer.from("hello");
    const h = hashBuffer(buf);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashBuffer(buf)).toBe(h);
  });

  it("should return different hashes for different buffers", () => {
    expect(hashBuffer(Buffer.from("a"))).not.toBe(hashBuffer(Buffer.from("b")));
  });
});

describe("assetKey", () => {
  it("should format the key as functions/{name}/{filename}", () => {
    expect(assetKey("my-fn", "index.ts")).toBe("functions/my-fn/index.ts");
    expect(assetKey("other-fn", "package.json")).toBe("functions/other-fn/package.json");
  });
});

// ---------------------------------------------------------------------------
// uploadAsset
// ---------------------------------------------------------------------------

describe("FunctionAssetReconciler.uploadAsset", () => {
  it("should call strategy.write with the correct key", async () => {
    const reconciler = buildReconciler();
    const data = Buffer.from("content");
    await reconciler.uploadAsset("my-function", "index.ts", data);
    expect(mockDeps.strategy.write).toHaveBeenCalledWith("functions/my-function/index.ts", data);
  });

  it("should return the correct metadata shape", async () => {
    const reconciler = buildReconciler();
    const data = Buffer.from("content");
    const result = await reconciler.uploadAsset("my-function", "index.ts", data);
    expect(result).toMatchObject({
      filename: "index.ts",
      key: "functions/my-function/index.ts",
      hash: hashBuffer(data),
      size: data.byteLength,
      strategy: "default"
    });
    expect(result.uploadDate).toBeInstanceOf(Date);
  });

  it("should set size equal to data.byteLength", async () => {
    const reconciler = buildReconciler();
    const data = Buffer.from("hello world!");
    const result = await reconciler.uploadAsset("my-function", "package.json", data);
    expect(result.size).toBe(data.byteLength);
  });
});

// ---------------------------------------------------------------------------
// snapshotAsset
// ---------------------------------------------------------------------------

describe("FunctionAssetReconciler.snapshotAsset", () => {
  it("should return null and NOT call strategy.read when prevAsset is null", async () => {
    const reconciler = buildReconciler();
    const result = await reconciler.snapshotAsset(null);
    expect(result).toBeNull();
    expect(mockDeps.strategy.read).not.toHaveBeenCalled();
  });

  it("should return the buffer from storage when prevAsset exists", async () => {
    const reconciler = buildReconciler();
    const buf = Buffer.from("snapshot-data");
    mockDeps.strategy.read.mockResolvedValue(buf);
    const result = await reconciler.snapshotAsset({key: "functions/my-function/index.ts"});
    expect(result).toEqual(buf);
    expect(mockDeps.strategy.read).toHaveBeenCalledWith("functions/my-function/index.ts");
  });

  it("should return null gracefully when storage.read throws", async () => {
    const reconciler = buildReconciler();
    mockDeps.strategy.read.mockRejectedValue(new Error("key not found"));
    const result = await reconciler.snapshotAsset({key: "functions/my-function/index.ts"});
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// rollbackDisk
// ---------------------------------------------------------------------------

describe("FunctionAssetReconciler.rollbackDisk", () => {
  it("should be a no-op when prevAsset is null", async () => {
    const reconciler = buildReconciler();
    await reconciler.rollbackDisk(mockFn, null);
    expect(mockDeps.strategy.read).not.toHaveBeenCalled();
    expect(mockDeps.preparationService.prepareIndex).not.toHaveBeenCalled();
    expect(mockDeps.preparationService.preparePackageJson).not.toHaveBeenCalled();
  });

  it("should restore and call prepareIndex for index.ts", async () => {
    const reconciler = buildReconciler();
    const buf = Buffer.from("ts-content");
    mockDeps.strategy.read.mockResolvedValue(buf);
    await reconciler.rollbackDisk(mockFn, {
      key: "functions/my-function/index.ts",
      filename: "index.ts"
    });
    expect(mockDeps.preparationService.writeFileBuffer).toHaveBeenCalledWith(
      mockFn,
      "index.ts",
      buf
    );
    expect(mockDeps.preparationService.prepareIndex).toHaveBeenCalledWith(mockFn);
    expect(mockDeps.preparationService.preparePackageJson).not.toHaveBeenCalled();
  });

  it("should restore and call prepareIndex for index.mjs", async () => {
    const reconciler = buildReconciler();
    const buf = Buffer.from("mjs-content");
    mockDeps.strategy.read.mockResolvedValue(buf);
    await reconciler.rollbackDisk(mockFn, {
      key: "functions/my-function/index.mjs",
      filename: "index.mjs"
    });
    expect(mockDeps.preparationService.prepareIndex).toHaveBeenCalledWith(mockFn);
    expect(mockDeps.preparationService.preparePackageJson).not.toHaveBeenCalled();
  });

  it("should restore and call preparePackageJson for package.json", async () => {
    const reconciler = buildReconciler();
    const buf = Buffer.from("{}");
    mockDeps.strategy.read.mockResolvedValue(buf);
    await reconciler.rollbackDisk(mockFn, {
      key: "functions/my-function/package.json",
      filename: "package.json"
    });
    expect(mockDeps.preparationService.writeFileBuffer).toHaveBeenCalledWith(
      mockFn,
      "package.json",
      buf
    );
    expect(mockDeps.preparationService.preparePackageJson).toHaveBeenCalledWith(mockFn);
    expect(mockDeps.preparationService.prepareIndex).not.toHaveBeenCalled();
  });

  it("should still attempt prepare when restoreAsset fails", async () => {
    const reconciler = buildReconciler();
    // strategy.read throws → restoreAsset catches and logs; prepare should still run
    mockDeps.strategy.read.mockRejectedValue(new Error("storage down"));
    await expect(
      reconciler.rollbackDisk(mockFn, {key: "functions/my-function/index.ts", filename: "index.ts"})
    ).resolves.toBeUndefined();
    expect(mockDeps.preparationService.prepareIndex).toHaveBeenCalled();
  });

  it("should NOT re-throw when the prepare step fails", async () => {
    const reconciler = buildReconciler();
    mockDeps.strategy.read.mockResolvedValue(Buffer.from("x"));
    mockDeps.preparationService.prepareIndex.mockRejectedValue(new Error("compile error"));
    await expect(
      reconciler.rollbackDisk(mockFn, {key: "functions/my-function/index.ts", filename: "index.ts"})
    ).resolves.toBeUndefined();
  });

  it("should throw for an unknown filename (default case guard)", async () => {
    const reconciler = buildReconciler();
    await expect(
      reconciler.rollbackDisk(mockFn, {
        key: "functions/my-function/tsconfig.json",
        filename: "tsconfig.json" as any
      })
    ).rejects.toThrow(/Unknown asset filename/);
  });
});

// ---------------------------------------------------------------------------
// rollback
// ---------------------------------------------------------------------------

describe("FunctionAssetReconciler.rollback", () => {
  it("should write prevBuffer to storage and then call rollbackDisk when prevBuffer is not null", async () => {
    const reconciler = buildReconciler();
    const prevBuffer = Buffer.from("old-content");
    const prevAsset = {key: "functions/my-function/index.ts", filename: "index.ts" as const};
    mockDeps.strategy.read.mockResolvedValue(prevBuffer);

    await reconciler.rollback(mockFn, prevAsset, "functions/my-function/index.ts", prevBuffer);

    expect(mockDeps.strategy.write).toHaveBeenCalledWith(
      "functions/my-function/index.ts",
      prevBuffer
    );
    // rollbackDisk triggers restoreAsset + prepare
    expect(mockDeps.preparationService.prepareIndex).toHaveBeenCalled();
  });

  it("should delete the uploaded key from storage and call rollbackDisk when prevBuffer is null", async () => {
    const reconciler = buildReconciler();
    mockDeps.strategy.read.mockResolvedValue(Buffer.from("x"));

    await reconciler.rollback(mockFn, null, "functions/my-function/index.ts", null);

    expect(mockDeps.strategy.delete).toHaveBeenCalledWith("functions/my-function/index.ts");
    // rollbackDisk is a no-op when prevAsset is null
    expect(mockDeps.preparationService.prepareIndex).not.toHaveBeenCalled();
  });

  it("should still call rollbackDisk when the storage write fails during rollback", async () => {
    const reconciler = buildReconciler();
    const prevBuffer = Buffer.from("old");
    const prevAsset = {key: "functions/my-function/index.ts", filename: "index.ts" as const};
    mockDeps.strategy.write.mockRejectedValue(new Error("storage error"));
    // restoreAsset also calls strategy.read; give it a value so prepare runs
    mockDeps.strategy.read.mockResolvedValue(prevBuffer);

    await expect(
      reconciler.rollback(mockFn, prevAsset, "functions/my-function/index.ts", prevBuffer)
    ).resolves.toBeUndefined();

    // Despite write failure, rollbackDisk should still have been called
    expect(mockDeps.preparationService.prepareIndex).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// reconcileFunction
// ---------------------------------------------------------------------------

describe("FunctionAssetReconciler.reconcileFunction", () => {
  it("should do nothing when no stored assets exist", async () => {
    const reconciler = buildReconciler();
    mockDeps.assetService.findByFunction.mockResolvedValue([]);
    await reconciler.reconcileFunction(mockFn);
    expect(mockDeps.strategy.read).not.toHaveBeenCalled();
    expect(mockDeps.preparationService.prepare).not.toHaveBeenCalled();
  });

  it("should skip download and prepare when all hashes match (performance)", async () => {
    const reconciler = buildReconciler();
    const data = Buffer.from("same-content");
    const hash = hashBuffer(data);
    mockDeps.assetService.findByFunction.mockResolvedValue([
      {
        filename: "index.ts",
        key: "functions/my-function/index.ts",
        hash,
        size: data.byteLength,
        strategy: "default",
        functionId: mockFn._id
      }
    ]);
    mockDeps.preparationService.readFileBuffer.mockResolvedValue(data);

    await reconciler.reconcileFunction(mockFn);

    expect(mockDeps.strategy.read).not.toHaveBeenCalled();
    expect(mockDeps.preparationService.prepare).not.toHaveBeenCalled();
  });

  it("should download and restore when hash mismatches, then call prepare once", async () => {
    const reconciler = buildReconciler();
    const remoteData = Buffer.from("remote-content");
    const localData = Buffer.from("stale-content");
    const remoteHash = hashBuffer(remoteData);

    mockDeps.assetService.findByFunction.mockResolvedValue([
      {
        filename: "index.ts",
        key: "functions/my-function/index.ts",
        hash: remoteHash,
        size: remoteData.byteLength,
        strategy: "default",
        functionId: mockFn._id
      }
    ]);
    mockDeps.preparationService.readFileBuffer.mockResolvedValue(localData);
    mockDeps.strategy.read.mockResolvedValue(remoteData);

    await reconciler.reconcileFunction(mockFn);

    expect(mockDeps.strategy.read).toHaveBeenCalledWith("functions/my-function/index.ts");
    expect(mockDeps.preparationService.writeFileBuffer).toHaveBeenCalledWith(
      mockFn,
      "index.ts",
      remoteData
    );
    expect(mockDeps.preparationService.prepareIndex).toHaveBeenCalledTimes(1);
    expect(mockDeps.preparationService.preparePackageJson).not.toHaveBeenCalled();
    expect(mockDeps.preparationService.prepare).not.toHaveBeenCalled();
  });

  it("should download when file is missing from disk (readFileBuffer → null)", async () => {
    const reconciler = buildReconciler();
    const remoteData = Buffer.from("remote-content");
    const remoteHash = hashBuffer(remoteData);

    mockDeps.assetService.findByFunction.mockResolvedValue([
      {
        filename: "index.ts",
        key: "functions/my-function/index.ts",
        hash: remoteHash,
        size: remoteData.byteLength,
        strategy: "default",
        functionId: mockFn._id
      }
    ]);
    mockDeps.preparationService.readFileBuffer.mockResolvedValue(null);
    mockDeps.strategy.read.mockResolvedValue(remoteData);

    await reconciler.reconcileFunction(mockFn);

    expect(mockDeps.strategy.read).toHaveBeenCalled();
    expect(mockDeps.preparationService.prepareIndex).toHaveBeenCalledTimes(1);
    expect(mockDeps.preparationService.prepare).not.toHaveBeenCalled();
  });

  it("should call granular prepare methods for each changed asset type", async () => {
    const reconciler = buildReconciler();
    const remoteData = Buffer.from("remote");
    const remoteHash = hashBuffer(remoteData);
    const localData = Buffer.from("local");

    mockDeps.assetService.findByFunction.mockResolvedValue([
      {
        filename: "index.ts",
        key: "functions/my-function/index.ts",
        hash: remoteHash,
        size: remoteData.byteLength,
        strategy: "default",
        functionId: mockFn._id
      },
      {
        filename: "package.json",
        key: "functions/my-function/package.json",
        hash: remoteHash,
        size: remoteData.byteLength,
        strategy: "default",
        functionId: mockFn._id
      }
    ]);
    mockDeps.preparationService.readFileBuffer.mockResolvedValue(localData);
    mockDeps.strategy.read.mockResolvedValue(remoteData);

    await reconciler.reconcileFunction(mockFn);

    expect(mockDeps.preparationService.prepareIndex).toHaveBeenCalledTimes(1);
    expect(mockDeps.preparationService.preparePackageJson).toHaveBeenCalledTimes(1);
    expect(mockDeps.preparationService.prepare).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// reconcileAll
// ---------------------------------------------------------------------------

describe("FunctionAssetReconciler.reconcileAll", () => {
  it("should resolve without error for an empty array", async () => {
    const reconciler = buildReconciler();
    await expect(reconciler.reconcileAll([])).resolves.toBeUndefined();
  });

  it("should reconcile all functions even when one throws", async () => {
    const reconciler = buildReconciler();
    const fn2 = {...mockFn, _id: new ObjectId(), name: "fn-2"} as any;

    mockDeps.assetService.findByFunction
      .mockRejectedValueOnce(new Error("db error for fn1"))
      .mockResolvedValueOnce([]);

    await expect(reconciler.reconcileAll([mockFn, fn2])).resolves.toBeUndefined();
    // Both functions were attempted
    expect(mockDeps.assetService.findByFunction).toHaveBeenCalledTimes(2);
  });

  it("should process all functions", async () => {
    const reconciler = buildReconciler();
    const fn2 = {...mockFn, _id: new ObjectId(), name: "fn-2"} as any;
    mockDeps.assetService.findByFunction.mockResolvedValue([]);

    await reconciler.reconcileAll([mockFn, fn2]);

    expect(mockDeps.assetService.findByFunction).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// deleteAll
// ---------------------------------------------------------------------------

describe("FunctionAssetReconciler.deleteAll", () => {
  it("should call deleteFromStorage for each asset and then deleteByFunction", async () => {
    const reconciler = buildReconciler();
    mockDeps.assetService.findByFunction.mockResolvedValue([
      {
        filename: "index.ts",
        key: "functions/my-function/index.ts",
        hash: "aaa",
        size: 100,
        strategy: "default",
        functionId: mockFn._id
      },
      {
        filename: "package.json",
        key: "functions/my-function/package.json",
        hash: "bbb",
        size: 50,
        strategy: "default",
        functionId: mockFn._id
      }
    ]);

    await reconciler.deleteAll(mockFn);

    expect(mockDeps.strategy.delete).toHaveBeenCalledWith("functions/my-function/index.ts");
    expect(mockDeps.strategy.delete).toHaveBeenCalledWith("functions/my-function/package.json");
    expect(mockDeps.assetService.deleteByFunction).toHaveBeenCalledWith(mockFn._id);
  });

  it("should still call deleteByFunction when storage delete fails for some assets", async () => {
    const reconciler = buildReconciler();
    mockDeps.assetService.findByFunction.mockResolvedValue([
      {
        filename: "index.ts",
        key: "functions/my-function/index.ts",
        hash: "aaa",
        size: 100,
        strategy: "default",
        functionId: mockFn._id
      }
    ]);
    mockDeps.strategy.delete.mockRejectedValue(new Error("storage unavailable"));

    await expect(reconciler.deleteAll(mockFn)).resolves.toBeUndefined();
    expect(mockDeps.assetService.deleteByFunction).toHaveBeenCalledWith(mockFn._id);
  });
});

// ---------------------------------------------------------------------------
// Back-fill
// ---------------------------------------------------------------------------

describe("FunctionAssetReconciler.backfill", () => {
  const files = {
    "index.ts": Buffer.from("index"),
    "package.json": Buffer.from("{}")
  };

  beforeEach(() => {
    mockDeps.storageOptions.strategy = "awss3";
    mockDeps.preparationService.readFileBuffer.mockImplementation(
      async (_fn, filename) => files[filename] ?? null
    );
  });

  it("should do nothing with the default strategy", async () => {
    mockDeps.storageOptions.strategy = "default";
    const reconciler = buildReconciler();

    await reconciler.backfill([mockFn]);

    expect(mockDeps.assetService.findByFunction).not.toHaveBeenCalled();
    expect(mockDeps.strategy.write).not.toHaveBeenCalled();
  });

  it("should upload and record the local files of a function without stored assets", async () => {
    const reconciler = buildReconciler();

    await reconciler.backfill([mockFn]);

    expect(mockDeps.strategy.write).toHaveBeenCalledWith(
      "functions/my-function/index.ts",
      files["index.ts"]
    );
    expect(mockDeps.strategy.write).toHaveBeenCalledWith(
      "functions/my-function/package.json",
      files["package.json"]
    );
    expect(mockDeps.assetService.upsertAsset).toHaveBeenCalledWith(
      mockFn._id,
      "index.ts",
      expect.objectContaining({
        key: "functions/my-function/index.ts",
        hash: hashBuffer(files["index.ts"]),
        strategy: "awss3"
      })
    );
    expect(mockDeps.assetService.upsertAsset).toHaveBeenCalledTimes(2);
  });

  it("should stamp each upload so this replica's watcher ignores it", async () => {
    const reconciler = buildReconciler();

    await reconciler.backfill([mockFn]);

    expect(mockDeps.tracker.stamp).toHaveBeenCalledWith({
      functionId: mockFn._id.toHexString(),
      filename: "index.ts",
      hash: hashBuffer(files["index.ts"])
    });
  });

  it("should not read or upload anything for a function that has stored assets", async () => {
    mockDeps.assetService.findByFunction.mockResolvedValue([{filename: "package.json"}]);
    const reconciler = buildReconciler();

    await reconciler.backfill([mockFn]);

    expect(mockDeps.preparationService.readFileBuffer).not.toHaveBeenCalled();
    expect(mockDeps.strategy.write).not.toHaveBeenCalled();
  });

  it("should skip files missing on disk", async () => {
    mockDeps.preparationService.readFileBuffer.mockImplementation(async (_fn, filename) =>
      filename == "package.json" ? files["package.json"] : null
    );
    const reconciler = buildReconciler();

    await reconciler.backfill([mockFn]);

    expect(mockDeps.strategy.write).toHaveBeenCalledTimes(1);
    expect(mockDeps.assetService.upsertAsset).toHaveBeenCalledWith(
      mockFn._id,
      "package.json",
      expect.anything()
    );
  });

  it("should warn about functions with neither stored assets nor local files", async () => {
    mockDeps.preparationService.readFileBuffer.mockResolvedValue(null);
    const reconciler = buildReconciler();
    const warn = jest.spyOn((reconciler as any).logger, "warn").mockImplementation(() => {});

    await reconciler.backfill([mockFn]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("my-function"));
  });

  it("should continue with other functions when one fails", async () => {
    const other = {...mockFn, _id: new ObjectId(), name: "other"};
    mockDeps.assetService.findByFunction
      .mockRejectedValueOnce(new Error("db"))
      .mockResolvedValueOnce([]);
    const reconciler = buildReconciler();

    await reconciler.backfill([mockFn, other]);

    expect(mockDeps.strategy.write).toHaveBeenCalledWith(
      "functions/other/index.ts",
      files["index.ts"]
    );
  });

  it("should upload at most four functions at a time", async () => {
    let running = 0;
    let peak = 0;
    mockDeps.assetService.findByFunction.mockImplementation(async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise(r => setTimeout(r, 5));
      running--;
      return [{filename: "index.ts"}];
    });
    const reconciler = buildReconciler();

    await reconciler.backfill(Array.from({length: 10}, (_, i) => ({...mockFn, name: `fn-${i}`})));

    expect(mockDeps.assetService.findByFunction).toHaveBeenCalledTimes(10);
    expect(peak).toBe(4);
  });
});
