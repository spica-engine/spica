import {ObjectId} from "@spica-server/database";
import {applyAssetChange} from "@spica-server/function/src/asset-pipeline";
import {hashBuffer} from "@spica-server/function/src/asset-reconciler";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const makeFn = () =>
  ({
    _id: new ObjectId(),
    name: "my-function",
    language: "typescript",
    timeout: 30,
    triggers: {},
    env: {}
  }) as any;

const makeReconciler = (overrides: Partial<typeof mockReconciler> = {}) => ({
  ...mockReconciler,
  ...overrides
});

let mockReconciler: {
  uploadAsset: jest.Mock;
  snapshotAsset: jest.Mock;
  rollbackDisk: jest.Mock;
  rollback: jest.Mock;
};

let mockAssetService: {
  findByFilename: jest.Mock;
  upsertAsset: jest.Mock;
};

let mockTracker: {stamp: jest.Mock};

beforeEach(() => {
  const defaultData = Buffer.from("new-content");
  const defaultRecord = {
    filename: "index.ts",
    key: "functions/my-function/index.ts",
    hash: hashBuffer(defaultData),
    size: defaultData.byteLength,
    uploadDate: new Date(),
    strategy: "default"
  };

  mockReconciler = {
    uploadAsset: jest.fn().mockResolvedValue(defaultRecord),
    snapshotAsset: jest.fn().mockResolvedValue(null),
    rollbackDisk: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined)
  };

  mockAssetService = {
    findByFilename: jest.fn().mockResolvedValue(null),
    upsertAsset: jest.fn().mockResolvedValue(undefined)
  };

  mockTracker = {stamp: jest.fn()};
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("applyAssetChange — happy path", () => {
  it("should execute all steps for a brand-new file (no prevAsset)", async () => {
    const fn = makeFn();
    const data = Buffer.from("new-content");
    const op = jest.fn().mockResolvedValue(data);

    await applyAssetChange(
      fn,
      "index.ts",
      op,
      mockReconciler as any,
      mockAssetService as any,
      null
    );

    expect(op).toHaveBeenCalledTimes(1);
    expect(mockReconciler.uploadAsset).toHaveBeenCalledWith(fn.name, "index.ts", data);
    expect(mockAssetService.upsertAsset).toHaveBeenCalledTimes(1);
  });

  it("should upload and persist when content has changed (hash differs from prevAsset)", async () => {
    const fn = makeFn();
    const newData = Buffer.from("updated-content");
    const oldHash = hashBuffer(Buffer.from("old-content"));
    mockAssetService.findByFilename.mockResolvedValue({
      key: "functions/my-function/index.ts",
      hash: oldHash,
      filename: "index.ts"
    });
    mockReconciler.uploadAsset.mockResolvedValue({
      filename: "index.ts",
      key: "functions/my-function/index.ts",
      hash: hashBuffer(newData),
      size: newData.byteLength,
      uploadDate: new Date(),
      strategy: "default"
    });

    await applyAssetChange(
      fn,
      "index.ts",
      jest.fn().mockResolvedValue(newData),
      mockReconciler as any,
      mockAssetService as any,
      null
    );

    expect(mockReconciler.uploadAsset).toHaveBeenCalled();
    expect(mockAssetService.upsertAsset).toHaveBeenCalled();
  });

  it("should return early without uploading when content is identical (hash match)", async () => {
    const fn = makeFn();
    const data = Buffer.from("same-content");
    const hash = hashBuffer(data);
    mockAssetService.findByFilename.mockResolvedValue({
      key: "functions/my-function/index.ts",
      hash,
      filename: "index.ts"
    });

    await applyAssetChange(
      fn,
      "index.ts",
      jest.fn().mockResolvedValue(data),
      mockReconciler as any,
      mockAssetService as any,
      null
    );

    expect(mockReconciler.uploadAsset).not.toHaveBeenCalled();
    expect(mockAssetService.upsertAsset).not.toHaveBeenCalled();
  });

  it("should complete successfully when tracker is null (no stamp attempted)", async () => {
    const fn = makeFn();
    await expect(
      applyAssetChange(
        fn,
        "index.ts",
        jest.fn().mockResolvedValue(Buffer.from("x")),
        mockReconciler as any,
        mockAssetService as any,
        null
      )
    ).resolves.toBeUndefined();
  });

  it("should call tracker.stamp with correct key before upsertAsset", async () => {
    const fn = makeFn();
    const data = Buffer.from("new-content");
    const record = {
      filename: "index.ts",
      key: "functions/my-function/index.ts",
      hash: hashBuffer(data),
      size: data.byteLength,
      uploadDate: new Date(),
      strategy: "default"
    };
    mockReconciler.uploadAsset.mockResolvedValue(record);

    const stampOrder: string[] = [];
    mockTracker.stamp.mockImplementation(() => stampOrder.push("stamp"));
    mockAssetService.upsertAsset.mockImplementation(async () => stampOrder.push("upsert"));

    await applyAssetChange(
      fn,
      "index.ts",
      jest.fn().mockResolvedValue(data),
      mockReconciler as any,
      mockAssetService as any,
      mockTracker as any
    );

    expect(mockTracker.stamp).toHaveBeenCalledWith({
      functionId: fn._id.toHexString(),
      filename: "index.ts",
      hash: record.hash
    });
    // stamp must precede upsert
    expect(stampOrder).toEqual(["stamp", "upsert"]);
  });
});

// ---------------------------------------------------------------------------
// Rollback — Step 2: op failure
// ---------------------------------------------------------------------------

describe("applyAssetChange — rollback on op failure (step 2)", () => {
  it("should call rollbackDisk(fn, null) and re-throw when op fails and there is no prevAsset", async () => {
    const fn = makeFn();
    const opError = new Error("disk write failed");
    mockAssetService.findByFilename.mockResolvedValue(null);

    await expect(
      applyAssetChange(
        fn,
        "index.ts",
        jest.fn().mockRejectedValue(opError),
        mockReconciler as any,
        mockAssetService as any,
        null
      )
    ).rejects.toThrow("disk write failed");

    expect(mockReconciler.rollbackDisk).toHaveBeenCalledWith(fn, null);
    expect(mockReconciler.uploadAsset).not.toHaveBeenCalled();
  });

  it("should call rollbackDisk(fn, prevAsset) and re-throw when op fails and prevAsset exists", async () => {
    const fn = makeFn();
    const prevAsset = {key: "functions/my-function/index.ts", filename: "index.ts", hash: "old"};
    mockAssetService.findByFilename.mockResolvedValue(prevAsset);
    const opError = new Error("compile error");

    await expect(
      applyAssetChange(
        fn,
        "index.ts",
        jest.fn().mockRejectedValue(opError),
        mockReconciler as any,
        mockAssetService as any,
        null
      )
    ).rejects.toThrow("compile error");

    expect(mockReconciler.rollbackDisk).toHaveBeenCalledWith(fn, prevAsset);
  });
});

// ---------------------------------------------------------------------------
// Rollback — Step 5: upload failure
// ---------------------------------------------------------------------------

describe("applyAssetChange — rollback on upload failure (step 5)", () => {
  it("should call rollback(fn, null, uploadedKey, null) and re-throw for a new file", async () => {
    const fn = makeFn();
    const data = Buffer.from("content");
    mockAssetService.findByFilename.mockResolvedValue(null);
    mockReconciler.snapshotAsset.mockResolvedValue(null);
    mockReconciler.uploadAsset.mockRejectedValue(new Error("storage unavailable"));

    await expect(
      applyAssetChange(
        fn,
        "index.ts",
        jest.fn().mockResolvedValue(data),
        mockReconciler as any,
        mockAssetService as any,
        null
      )
    ).rejects.toThrow("storage unavailable");

    expect(mockReconciler.rollback).toHaveBeenCalledWith(
      fn,
      null,
      "functions/my-function/index.ts",
      null
    );
    expect(mockAssetService.upsertAsset).not.toHaveBeenCalled();
  });

  it("should call rollback(fn, prevAsset, key, prevBuffer) and re-throw when prevAsset exists", async () => {
    const fn = makeFn();
    const data = Buffer.from("updated");
    const prevBuffer = Buffer.from("old-storage-content");
    const prevAsset = {
      key: "functions/my-function/index.ts",
      filename: "index.ts" as const,
      hash: hashBuffer(Buffer.from("old"))
    };
    mockAssetService.findByFilename.mockResolvedValue(prevAsset);
    mockReconciler.snapshotAsset.mockResolvedValue(prevBuffer);
    mockReconciler.uploadAsset.mockRejectedValue(new Error("upload failed"));

    await expect(
      applyAssetChange(
        fn,
        "index.ts",
        jest.fn().mockResolvedValue(data),
        mockReconciler as any,
        mockAssetService as any,
        null
      )
    ).rejects.toThrow("upload failed");

    expect(mockReconciler.rollback).toHaveBeenCalledWith(fn, prevAsset, prevAsset.key, prevBuffer);
  });
});

// ---------------------------------------------------------------------------
// Rollback — Step 6: DB/metadata failure
// ---------------------------------------------------------------------------

describe("applyAssetChange — rollback on DB failure (step 6)", () => {
  it("should call rollback and re-throw when upsertAsset fails for a new file", async () => {
    const fn = makeFn();
    const data = Buffer.from("content");
    const record = {
      filename: "index.ts",
      key: "functions/my-function/index.ts",
      hash: hashBuffer(data),
      size: data.byteLength,
      uploadDate: new Date(),
      strategy: "default"
    };
    mockAssetService.findByFilename.mockResolvedValue(null);
    mockReconciler.snapshotAsset.mockResolvedValue(null);
    mockReconciler.uploadAsset.mockResolvedValue(record);
    mockAssetService.upsertAsset.mockRejectedValue(new Error("mongo write failed"));

    await expect(
      applyAssetChange(
        fn,
        "index.ts",
        jest.fn().mockResolvedValue(data),
        mockReconciler as any,
        mockAssetService as any,
        null
      )
    ).rejects.toThrow("mongo write failed");

    expect(mockReconciler.rollback).toHaveBeenCalledWith(fn, null, record.key, null);
  });

  it("should pass prevAsset and prevBuffer to rollback when upsertAsset fails on an existing file", async () => {
    const fn = makeFn();
    const newData = Buffer.from("updated");
    const prevBuffer = Buffer.from("old");
    const prevAsset = {
      key: "functions/my-function/index.ts",
      filename: "index.ts" as const,
      hash: hashBuffer(Buffer.from("different"))
    };
    const record = {
      filename: "index.ts",
      key: "functions/my-function/index.ts",
      hash: hashBuffer(newData),
      size: newData.byteLength,
      uploadDate: new Date(),
      strategy: "default"
    };
    mockAssetService.findByFilename.mockResolvedValue(prevAsset);
    mockReconciler.snapshotAsset.mockResolvedValue(prevBuffer);
    mockReconciler.uploadAsset.mockResolvedValue(record);
    mockAssetService.upsertAsset.mockRejectedValue(new Error("db error"));

    await expect(
      applyAssetChange(
        fn,
        "index.ts",
        jest.fn().mockResolvedValue(newData),
        mockReconciler as any,
        mockAssetService as any,
        null
      )
    ).rejects.toThrow("db error");

    expect(mockReconciler.rollback).toHaveBeenCalledWith(fn, prevAsset, record.key, prevBuffer);
  });
});

// ---------------------------------------------------------------------------
// Performance: hash comparison prevents unnecessary uploads
// ---------------------------------------------------------------------------

describe("applyAssetChange — performance", () => {
  it("should NOT call uploadAsset when the buffer hash equals the stored hash", async () => {
    const fn = makeFn();
    const data = Buffer.from("unchanged-content");
    const hash = hashBuffer(data);
    mockAssetService.findByFilename.mockResolvedValue({
      key: "functions/my-function/index.ts",
      filename: "index.ts",
      hash
    });

    await applyAssetChange(
      fn,
      "index.ts",
      jest.fn().mockResolvedValue(data),
      mockReconciler as any,
      mockAssetService as any,
      null
    );

    expect(mockReconciler.uploadAsset).not.toHaveBeenCalled();
    expect(mockReconciler.snapshotAsset).not.toHaveBeenCalled();
  });
});
