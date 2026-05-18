import {ObjectId} from "@spica-server/database";
import {
  applyAssetChange,
  applyAssetDelete,
  AssetChangeFile
} from "@spica-server/function/src/asset-pipeline";
import {hashBuffer} from "@spica-server/function/src/asset-reconciler";
import * as os from "os";
import * as path from "path";
import * as fsSync from "fs";

describe("applyAssetChange", () => {
  let tmpDir: string;
  let fn: any;

  const makeReconciler = () => ({
    writeLocalAsset: jest
      .fn()
      .mockImplementation(async (_fn: any, filename: string, data: Buffer) => {
        const filePath = path.join(tmpDir, _fn.name, filename);
        await fsSync.promises.mkdir(path.dirname(filePath), {recursive: true});
        await fsSync.promises.writeFile(filePath, data);
      }),
    readLocalAsset: jest.fn().mockImplementation(async (_fn: any, filename: string) => {
      const filePath = path.join(tmpDir, _fn.name, filename);
      try {
        const buffer = await fsSync.promises.readFile(filePath);
        return {buffer, hash: hashBuffer(buffer)};
      } catch (e: any) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    }),
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
    deleteFromStorage: jest.fn().mockResolvedValue(undefined),
    restoreAssets: jest.fn().mockResolvedValue(undefined)
  });

  const makeAssetService = () => ({
    findByFunction: jest.fn().mockResolvedValue([]),
    upsertMany: jest.fn().mockResolvedValue(undefined),
    deleteByFunction: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "pipeline-test-"));
    fn = {_id: new ObjectId(), name: "test-fn", language: "typescript"};
  });

  afterEach(async () => {
    await fsSync.promises.rm(tmpDir, {recursive: true, force: true});
    jest.clearAllMocks();
  });

  it("should write files, run localOp, upload to strategy, and upsert metadata", async () => {
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();
    const localOp = jest.fn().mockResolvedValue(undefined);

    const fnDir = path.join(tmpDir, fn.name);
    await fsSync.promises.mkdir(fnDir, {recursive: true});

    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("console.log(1)")}];

    // Write the file to disk before calling (simulating what localOp would do)
    await fsSync.promises.writeFile(path.join(fnDir, "index.ts"), files[0].data);

    await applyAssetChange(fn, files, reconciler, assetService, null, localOp);

    expect(localOp).toHaveBeenCalled();
    expect(reconciler.uploadAsset).toHaveBeenCalledTimes(1);
    expect(assetService.upsertMany).toHaveBeenCalledTimes(1);
  });

  it("should rollback local files when localOp throws", async () => {
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

    const localOp = jest.fn().mockRejectedValue(new Error("compile failed"));

    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("bad-code")}];

    await expect(
      applyAssetChange(fn, files, reconciler, assetService, null, localOp)
    ).rejects.toThrow("compile failed");

    // Upload step never reached
    expect(reconciler.uploadAsset).not.toHaveBeenCalled();
    // Rollback attempted
    expect(reconciler.restoreAssets).toHaveBeenCalled();
  });

  it("should rollback and best-effort delete when strategy.write throws", async () => {
    const reconciler = makeReconciler() as any;
    (reconciler.uploadAsset as jest.Mock).mockRejectedValueOnce(new Error("upload failed"));
    const assetService = makeAssetService();
    const localOp = jest.fn().mockResolvedValue(undefined);

    const fnDir = path.join(tmpDir, fn.name);
    await fsSync.promises.mkdir(fnDir, {recursive: true});
    await fsSync.promises.writeFile(path.join(fnDir, "index.ts"), "code");

    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("code")}];

    await expect(
      applyAssetChange(fn, files, reconciler, assetService, null, localOp)
    ).rejects.toThrow("upload failed");

    expect(assetService.upsertMany).not.toHaveBeenCalled();
    expect(reconciler.restoreAssets).toHaveBeenCalled();
  });

  it("should rollback and delete uploaded keys when upsertMany throws", async () => {
    const reconciler = makeReconciler() as any;
    const assetService = makeAssetService();
    assetService.upsertMany.mockRejectedValueOnce(new Error("db down"));
    const localOp = jest.fn().mockResolvedValue(undefined);

    const fnDir = path.join(tmpDir, fn.name);
    await fsSync.promises.mkdir(fnDir, {recursive: true});
    await fsSync.promises.writeFile(path.join(fnDir, "index.ts"), "code");

    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("code")}];

    await expect(
      applyAssetChange(fn, files, reconciler, assetService, null, localOp)
    ).rejects.toThrow("db down");

    // Should attempt to clean up the uploaded key
    expect(reconciler.deleteFromStorage).toHaveBeenCalledTimes(1);
  });
});

describe("applyAssetDelete", () => {
  it("should delete all remote assets and metadata", async () => {
    const reconciler = {
      deleteFromStorage: jest.fn().mockResolvedValue(undefined)
    } as any;
    const assetService = {
      findByFunction: jest
        .fn()
        .mockResolvedValue([{key: "functions/abc/index.ts"}, {key: "functions/abc/package.json"}]),
      deleteByFunction: jest.fn().mockResolvedValue(undefined)
    } as any;

    const fn: any = {_id: new ObjectId(), name: "fn"};
    await applyAssetDelete(fn, reconciler, assetService);

    expect(reconciler.deleteFromStorage).toHaveBeenCalledTimes(2);
    expect(assetService.deleteByFunction).toHaveBeenCalledWith(fn._id);
  });
});
