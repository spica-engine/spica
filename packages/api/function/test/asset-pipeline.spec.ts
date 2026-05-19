import {ObjectId} from "@spica-server/database";
import {applyAssetChange, AssetChangeFile} from "@spica-server/function/src/asset-pipeline";
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
    snapshotAssets: jest.fn().mockResolvedValue(new Map()),
    rollbackDisk: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined)
  });

  const makeAssetService = () => ({
    findByFunction: jest.fn().mockResolvedValue([]),
    upsertMany: jest.fn().mockResolvedValue(undefined),
    deleteByFunction: jest.fn().mockResolvedValue(undefined)
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
    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("console.log(1)")}];
    const op = jest.fn().mockResolvedValue(files);

    await applyAssetChange(fn, op, reconciler, assetService, null);

    expect(op).toHaveBeenCalled();
    expect(reconciler.uploadAsset).toHaveBeenCalledTimes(1);
    expect(assetService.upsertMany).toHaveBeenCalledTimes(1);
  });

  it("should rollback local files when op throws", async () => {
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();

    assetService.findByFunction.mockResolvedValueOnce([
      {
        filename: "index.ts",
        key: "functions/x/index.ts",
        hash: hashBuffer(Buffer.from("previous")),
        strategy: "default"
      }
    ]);

    const op = jest.fn().mockRejectedValue(new Error("compile failed"));

    await expect(applyAssetChange(fn, op, reconciler, assetService, null)).rejects.toThrow(
      "compile failed"
    );

    // Upload step never reached
    expect(reconciler.uploadAsset).not.toHaveBeenCalled();
    // Disk rollback (restore + prepare) attempted
    expect(reconciler.rollbackDisk).toHaveBeenCalledWith(fn, expect.any(Array));
  });

  it("should rollback and best-effort delete when strategy.write throws", async () => {
    const reconciler = makeReconciler() as any;
    (reconciler.uploadAsset as jest.Mock).mockRejectedValueOnce(new Error("upload failed"));
    const assetService = makeAssetService();
    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("code")}];
    const op = jest.fn().mockResolvedValue(files);

    await expect(applyAssetChange(fn, op, reconciler, assetService, null)).rejects.toThrow(
      "upload failed"
    );

    expect(assetService.upsertMany).not.toHaveBeenCalled();
    // Full rollback: storage + disk
    expect(reconciler.rollback).toHaveBeenCalledTimes(1);
  });

  it("should rollback and delete uploaded keys when upsertMany throws", async () => {
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();
    assetService.upsertMany.mockRejectedValueOnce(new Error("db down"));
    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("code")}];
    const op = jest.fn().mockResolvedValue(files);

    await expect(applyAssetChange(fn, op, reconciler, assetService, null)).rejects.toThrow(
      "db down"
    );

    // Full rollback: restore storage + disk
    expect(reconciler.rollback).toHaveBeenCalledTimes(1);
  });

  it("should skip upload and upsert when all files are unchanged", async () => {
    const data = Buffer.from("unchanged content");
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();

    // prevAssets already has the same hash as what op returns
    assetService.findByFunction.mockResolvedValueOnce([
      {filename: "index.ts", key: "functions/test-fn/index.ts", hash: hashBuffer(data)}
    ]);

    const op = jest.fn().mockResolvedValue([{filename: "index.ts", data}]);

    await applyAssetChange(fn, op, reconciler, assetService, null);

    expect(reconciler.uploadAsset).not.toHaveBeenCalled();
    expect(assetService.upsertMany).not.toHaveBeenCalled();
  });

  it("should not call snapshotAssets when op throws", async () => {
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();
    const op = jest.fn().mockRejectedValue(new Error("compile failed"));

    await expect(applyAssetChange(fn, op, reconciler, assetService, null)).rejects.toThrow(
      "compile failed"
    );

    expect(reconciler.snapshotAssets).not.toHaveBeenCalled();
  });

  it("should only upload and snapshot changed files when some are unchanged", async () => {
    const unchangedData = Buffer.from("same");
    const changedData = Buffer.from("new content");
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();

    assetService.findByFunction.mockResolvedValueOnce([
      {filename: "index.ts", key: "functions/test-fn/index.ts", hash: hashBuffer(unchangedData)},
      {filename: "package.json", key: "functions/test-fn/package.json", hash: "old-hash"}
    ]);

    const op = jest.fn().mockResolvedValue([
      {filename: "index.ts", data: unchangedData},
      {filename: "package.json", data: changedData}
    ]);

    await applyAssetChange(fn, op, reconciler, assetService, null);

    // Only the changed file was uploaded
    expect(reconciler.uploadAsset).toHaveBeenCalledTimes(1);
    expect(reconciler.uploadAsset).toHaveBeenCalledWith(fn.name, "package.json", changedData);

    // Snapshot was scoped to only the overwritten key
    expect(reconciler.snapshotAssets).toHaveBeenCalledWith([
      expect.objectContaining({filename: "package.json"})
    ]);
  });
});
