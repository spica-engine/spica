import {ObjectId} from "@spica-server/database";
import {applyAssetChange} from "@spica-server/function/src/asset-pipeline";
import {hashBuffer} from "@spica-server/function/src/asset-reconciler";

describe("applyAssetChange", () => {
  let fn: any;

  const makeReconciler = () => ({
    uploadAsset: jest
      .fn()
      .mockImplementation(async (functionName: string, filename: string, data: Buffer) => ({
        filename,
        key: `functions/${functionName}/${filename}`,
        hash: hashBuffer(data),
        size: data.byteLength,
        uploadDate: new Date(),
        strategy: "default"
      })),
    snapshotAsset: jest.fn().mockResolvedValue(null),
    rollbackDisk: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined)
  });

  const makeAssetService = () => ({
    findByFilename: jest.fn().mockResolvedValue(null),
    upsertAsset: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    fn = {_id: new ObjectId(), name: "test-fn", language: "typescript"};
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should run op, upload to strategy, and upsert metadata", async () => {
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();
    const op = jest.fn().mockResolvedValue(Buffer.from("console.log(1)"));

    await applyAssetChange(fn, "index.ts", op, reconciler, assetService, null);

    expect(op).toHaveBeenCalled();
    expect(reconciler.uploadAsset).toHaveBeenCalledTimes(1);
    expect(assetService.upsertAsset).toHaveBeenCalledTimes(1);
  });

  it("should rollback local file when op throws", async () => {
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();

    assetService.findByFilename.mockResolvedValueOnce({
      filename: "index.ts",
      key: "functions/x/index.ts",
      hash: hashBuffer(Buffer.from("previous")),
      strategy: "default"
    });

    const op = jest.fn().mockRejectedValue(new Error("compile failed"));

    await expect(
      applyAssetChange(fn, "index.ts", op, reconciler, assetService, null)
    ).rejects.toThrow("compile failed");

    // Upload step never reached
    expect(reconciler.uploadAsset).not.toHaveBeenCalled();
    // Disk rollback (restore + prepare) attempted with the single prev asset
    expect(reconciler.rollbackDisk).toHaveBeenCalledWith(
      fn,
      expect.objectContaining({filename: "index.ts"})
    );
  });

  it("should rollback and best-effort delete when strategy.write throws", async () => {
    const reconciler = makeReconciler() as any;
    (reconciler.uploadAsset as jest.Mock).mockRejectedValueOnce(new Error("upload failed"));
    const assetService = makeAssetService();
    const op = jest.fn().mockResolvedValue(Buffer.from("code"));

    await expect(
      applyAssetChange(fn, "index.ts", op, reconciler, assetService, null)
    ).rejects.toThrow("upload failed");

    expect(assetService.upsertAsset).not.toHaveBeenCalled();
    // Full rollback: storage key + disk
    expect(reconciler.rollback).toHaveBeenCalledTimes(1);
  });

  it("should rollback when upsertAsset throws", async () => {
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();
    assetService.upsertAsset.mockRejectedValueOnce(new Error("db down"));
    const op = jest.fn().mockResolvedValue(Buffer.from("code"));

    await expect(
      applyAssetChange(fn, "index.ts", op, reconciler, assetService, null)
    ).rejects.toThrow("db down");

    // Full rollback: restore storage + disk
    expect(reconciler.rollback).toHaveBeenCalledTimes(1);
  });

  it("should skip upload and upsert when file content is unchanged", async () => {
    const data = Buffer.from("unchanged content");
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();

    // prevAsset already has the same hash as what op returns
    assetService.findByFilename.mockResolvedValueOnce({
      filename: "index.ts",
      key: "functions/test-fn/index.ts",
      hash: hashBuffer(data)
    });

    const op = jest.fn().mockResolvedValue(data);

    await applyAssetChange(fn, "index.ts", op, reconciler, assetService, null);

    expect(reconciler.uploadAsset).not.toHaveBeenCalled();
    expect(assetService.upsertAsset).not.toHaveBeenCalled();
  });

  it("should not call snapshotAsset when op throws", async () => {
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();
    const op = jest.fn().mockRejectedValue(new Error("compile failed"));

    await expect(
      applyAssetChange(fn, "index.ts", op, reconciler, assetService, null)
    ).rejects.toThrow("compile failed");

    expect(reconciler.snapshotAsset).not.toHaveBeenCalled();
  });

  it("should snapshot existing asset when file previously existed", async () => {
    const prevData = Buffer.from("old content");
    const newData = Buffer.from("new content");
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();

    assetService.findByFilename.mockResolvedValueOnce({
      filename: "package.json",
      key: "functions/test-fn/package.json",
      hash: hashBuffer(prevData)
    });
    reconciler.snapshotAsset.mockResolvedValueOnce(prevData);

    const op = jest.fn().mockResolvedValue(newData);

    await applyAssetChange(fn, "package.json", op, reconciler, assetService, null);

    expect(reconciler.snapshotAsset).toHaveBeenCalledWith(
      expect.objectContaining({key: "functions/test-fn/package.json"})
    );
    expect(reconciler.uploadAsset).toHaveBeenCalledWith(fn.name, "package.json", newData);
    expect(assetService.upsertAsset).toHaveBeenCalledTimes(1);
  });
});
