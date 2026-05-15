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
  let options: any;
  let fn: any;

  const makeStrategy = () => ({
    read: jest.fn(),
    write: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true)
  });

  const makeReconciler = (strategy: any, storageOpts = {strategy: "default"}) => ({
    strategy,
    storageOptions: storageOpts,
    writeLocalAsset: jest
      .fn()
      .mockImplementation(async (_fn: any, filename: string, data: Buffer) => {
        const filePath = path.join(tmpDir, _fn.name, filename);
        await fsSync.promises.mkdir(path.dirname(filePath), {recursive: true});
        await fsSync.promises.writeFile(filePath, data);
      })
  });

  const makeAssetService = () => ({
    findByFunction: jest.fn().mockResolvedValue([]),
    upsertMany: jest.fn().mockResolvedValue(undefined),
    deleteByFunction: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "pipeline-test-"));
    fn = {_id: new ObjectId(), name: "test-fn", language: "typescript"};
    options = {root: tmpDir, timeout: 60, outDir: ".build"};
  });

  afterEach(async () => {
    await fsSync.promises.rm(tmpDir, {recursive: true, force: true});
    jest.clearAllMocks();
  });

  it("should write files, run localOp, upload to strategy, and upsert metadata", async () => {
    const strategy = makeStrategy();
    const reconciler = makeReconciler(strategy) as any;
    const assetService = makeAssetService();
    const localOp = jest.fn().mockResolvedValue(undefined);

    const fnDir = path.join(tmpDir, fn.name);
    await fsSync.promises.mkdir(fnDir, {recursive: true});

    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("console.log(1)")}];

    // Write the file to disk before calling (simulating what localOp would do)
    await fsSync.promises.writeFile(path.join(fnDir, "index.ts"), files[0].data);

    await applyAssetChange(fn, files, options, reconciler, assetService, null, localOp);

    expect(localOp).toHaveBeenCalled();
    expect(strategy.write).toHaveBeenCalledTimes(1);
    expect(assetService.upsertMany).toHaveBeenCalledTimes(1);
  });

  it("should rollback local files when localOp throws", async () => {
    const strategy = makeStrategy();
    const reconciler = makeReconciler(strategy) as any;
    const assetService = makeAssetService();

    // Store a previous state to restore to
    const prevData = Buffer.from("previous");
    strategy.read.mockResolvedValueOnce(prevData);
    assetService.findByFunction.mockResolvedValueOnce([
      {
        filename: "index.ts",
        key: "functions/x/index.ts",
        hash: hashBuffer(prevData),
        strategy: "default"
      }
    ]);

    const localOp = jest.fn().mockRejectedValue(new Error("compile failed"));

    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("bad-code")}];

    await expect(
      applyAssetChange(fn, files, options, reconciler, assetService, null, localOp)
    ).rejects.toThrow("compile failed");

    // Strategy.write should NOT have been called (upload step never reached)
    expect(strategy.write).not.toHaveBeenCalled();
  });

  it("should rollback and best-effort delete when strategy.write throws", async () => {
    const strategy = makeStrategy();
    strategy.write.mockRejectedValueOnce(new Error("upload failed"));
    const reconciler = makeReconciler(strategy) as any;
    const assetService = makeAssetService();
    const localOp = jest.fn().mockResolvedValue(undefined);

    const fnDir = path.join(tmpDir, fn.name);
    await fsSync.promises.mkdir(fnDir, {recursive: true});
    await fsSync.promises.writeFile(path.join(fnDir, "index.ts"), "code");

    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("code")}];

    await expect(
      applyAssetChange(fn, files, options, reconciler, assetService, null, localOp)
    ).rejects.toThrow("upload failed");

    expect(assetService.upsertMany).not.toHaveBeenCalled();
  });

  it("should rollback and delete uploaded keys when upsertMany throws", async () => {
    const strategy = makeStrategy();
    const reconciler = makeReconciler(strategy) as any;
    const assetService = makeAssetService();
    assetService.upsertMany.mockRejectedValueOnce(new Error("db down"));
    const localOp = jest.fn().mockResolvedValue(undefined);

    const fnDir = path.join(tmpDir, fn.name);
    await fsSync.promises.mkdir(fnDir, {recursive: true});
    await fsSync.promises.writeFile(path.join(fnDir, "index.ts"), "code");

    const files: AssetChangeFile[] = [{filename: "index.ts", data: Buffer.from("code")}];

    await expect(
      applyAssetChange(fn, files, options, reconciler, assetService, null, localOp)
    ).rejects.toThrow("db down");

    // Should attempt to clean up the uploaded key
    expect(strategy.delete).toHaveBeenCalledTimes(1);
  });
});

describe("applyAssetDelete", () => {
  it("should delete all remote assets and metadata", async () => {
    const strategy = {
      read: jest.fn(),
      write: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn()
    };
    const reconciler = {strategy} as any;
    const assetService = {
      findByFunction: jest
        .fn()
        .mockResolvedValue([{key: "functions/abc/index.ts"}, {key: "functions/abc/package.json"}]),
      deleteByFunction: jest.fn().mockResolvedValue(undefined)
    } as any;

    const fn: any = {_id: new ObjectId(), name: "fn"};
    await applyAssetDelete(fn, reconciler, assetService);

    expect(strategy.delete).toHaveBeenCalledTimes(2);
    expect(assetService.deleteByFunction).toHaveBeenCalledWith(fn._id);
  });
});
