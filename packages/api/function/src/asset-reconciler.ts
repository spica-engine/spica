import {Inject, Injectable, Logger} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {FunctionAssetService} from "@spica-server/function-services";
import {
  FunctionAsset,
  FunctionAssetFilename,
  FunctionAssetStrategy,
  FUNCTION_ASSET_STORAGE_OPTIONS,
  FUNCTION_ASSET_STRATEGY,
  FunctionAssetStorageOptions
} from "@spica-server/interface-function-asset-storage";
import {Function} from "@spica-server/interface-function";
import {FunctionPreparationService} from "./function-preparation.service.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";
import {FunctionArtifactManager} from "./artifact-manager.js";
import {hashBuffer, assetKey} from "./asset-keys.js";

export {hashBuffer, assetKey};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const BACKFILL_CONCURRENCY = 4;
const PREBUILT_RECONCILE_CONCURRENCY = 4;

type BackfillOutcome = "already-stored" | "uploaded" | "no-local-files";

async function forEachWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const lanes = Array.from({length: Math.min(limit, items.length)}, async () => {
    while (next < items.length) {
      await task(items[next++]);
    }
  });
  await Promise.all(lanes);
}

@Injectable()
export class FunctionAssetReconciler {
  private readonly logger = new Logger(FunctionAssetReconciler.name);

  constructor(
    @Inject(FUNCTION_ASSET_STRATEGY) private readonly strategy: FunctionAssetStrategy,
    @Inject(FUNCTION_ASSET_STORAGE_OPTIONS)
    private readonly storageOptions: FunctionAssetStorageOptions,
    private readonly assetService: FunctionAssetService,
    private readonly preparationService: FunctionPreparationService,
    private readonly tracker: SelfWriteTracker,
    private readonly artifactManager: FunctionArtifactManager
  ) {}

  async uploadAsset(
    functionName: string,
    filename: FunctionAssetFilename,
    data: Buffer
  ): Promise<Omit<FunctionAsset, "functionId" | "_id">> {
    const key = assetKey(functionName, filename);
    const hash = hashBuffer(data);
    await this.strategy.write(key, data);
    return {
      filename,
      key,
      hash,
      size: data.byteLength,
      uploadDate: new Date(),
      strategy: this.storageOptions.strategy
    };
  }

  private async readFromStorage(key: string): Promise<Buffer> {
    return this.strategy.read(key);
  }

  private async writeToStorage(key: string, data: Buffer): Promise<void> {
    return this.strategy.write(key, data);
  }

  private async deleteFromStorage(key: string): Promise<void> {
    return this.strategy.delete(key);
  }

  private async restoreAsset(
    fn: Function,
    prevAsset: {key: string; filename: FunctionAssetFilename} | null
  ): Promise<void> {
    if (!prevAsset) return;
    try {
      const data = await this.strategy.read(prevAsset.key);
      await this.preparationService.writeFileBuffer(fn, prevAsset.filename, data);
    } catch (e) {
      this.logger.error(
        `[rollback] Could not restore ${fn.name}/${prevAsset.filename}: ${e instanceof Error ? e.message : e}`
      );
    }
  }

  async snapshotAsset(prevAsset: {key: string} | null): Promise<Buffer | null> {
    if (!prevAsset) return null;
    try {
      return await this.readFromStorage(prevAsset.key);
    } catch {
      return null;
    }
  }

  async rollbackDisk(
    fn: Function,
    prevAsset: {key: string; filename: FunctionAssetFilename} | null
  ): Promise<void> {
    if (!prevAsset) return;
    await this.restoreAsset(fn, prevAsset);
    let prepareStep: () => Promise<void>;
    switch (prevAsset.filename) {
      case "package.json":
      case "package-lock.json":
        prepareStep = () => this.preparationService.preparePackageJson(fn);
        break;
      case "index.ts":
      case "index.mjs":
        prepareStep = () => this.preparationService.prepareIndex(fn);
        break;
      default:
        throw new Error(
          `[rollback] Unknown asset filename "${prevAsset.filename}" for function ${fn.name}`
        );
    }
    await prepareStep().catch(e => {
      this.logger.error(`[rollback] Post-rollback prepare failed for ${fn.name}: ${errMsg(e)}`);
    });
  }

  async rollback(
    fn: Function,
    prevAsset: {key: string; filename: FunctionAssetFilename} | null,
    uploadedKey: string,
    prevBuffer: Buffer | null
  ): Promise<void> {
    await (prevBuffer !== null
      ? this.writeToStorage(uploadedKey, prevBuffer).catch(() => {})
      : this.deleteFromStorage(uploadedKey).catch(() => {}));
    await this.rollbackDisk(fn, prevAsset);
  }

  async deleteAll(fn: Function & {_id: ObjectId}): Promise<void> {
    const prevAssets = await this.assetService.findByFunction(fn._id);
    await Promise.all(
      prevAssets.map(asset =>
        this.deleteFromStorage(asset.key).catch(e => {
          this.logger.error(`[rollback] Could not delete remote asset ${asset.key}: ${errMsg(e)}`);
        })
      )
    );
    await this.assetService.deleteByFunction(fn._id);
    await this.artifactManager.deleteArtifacts(fn);
  }

  async backfill(fns: Array<Function & {_id: ObjectId}>): Promise<void> {
    if (this.storageOptions.strategy == "default") return;

    const unrecoverable: string[] = [];
    await forEachWithConcurrency(fns, BACKFILL_CONCURRENCY, async fn => {
      try {
        const outcome = await this.backfillFunction(fn);
        if (outcome == "no-local-files") unrecoverable.push(fn.name);
      } catch (e) {
        this.logger.error(
          `[backfill] Failed for function ${fn.name}, retrying on next start: ${errMsg(e)}`
        );
      }
    });

    if (unrecoverable.length) {
      this.logger.warn(
        `[backfill] Functions without stored assets and without local files to upload, their code cannot be restored: ${unrecoverable.join(", ")}`
      );
    }
  }

  private async backfillFunction(fn: Function & {_id: ObjectId}): Promise<BackfillOutcome> {
    const records = await this.assetService.findByFunction(fn._id);
    if (records.length > 0) return "already-stored";

    const uploaded: Array<Omit<FunctionAsset, "functionId" | "_id">> = [];
    for (const filename of [this.preparationService.indexFilename(fn), "package.json"] as const) {
      const data = await this.preparationService.readFileBuffer(fn, filename);
      if (!data) continue;
      uploaded.push(await this.uploadAsset(fn.name, filename, data));
    }
    if (uploaded.length == 0) return "no-local-files";

    try {
      for (const {filename, key, hash, size, uploadDate, strategy} of uploaded) {
        this.tracker.stamp({functionId: fn._id.toHexString(), filename, hash});
        await this.assetService.upsertAsset(fn._id, filename, {
          key,
          hash,
          size,
          uploadDate,
          strategy
        });
      }
    } catch (e) {
      await this.assetService
        .deleteMany({
          $or: uploaded.map(({filename, hash}) => ({functionId: fn._id, filename, hash}))
        })
        .catch(rollbackError =>
          this.logger.error(
            `[backfill] Could not roll back records of ${fn.name}: ${errMsg(rollbackError)}`
          )
        );
      throw e;
    }

    this.logger.log(
      `[backfill] Uploaded ${uploaded.map(({filename}) => `${fn.name}/${filename}`).join(", ")}`
    );
    return "uploaded";
  }

  async syncSources(fn: Function & {_id: ObjectId}): Promise<FunctionAssetFilename[]> {
    const storedAssets = await this.assetService.findByFunction(fn._id);
    const changedFilenames: FunctionAssetFilename[] = [];

    for (const asset of storedAssets) {
      const buf = await this.preparationService.readFileBuffer(fn, asset.filename);
      const local = buf ? {hash: hashBuffer(buf)} : null;

      if (local && local.hash === asset.hash) {
        this.logger.debug(`[reconcile] ${fn.name}/${asset.filename} hash match — skipping`);
        continue;
      }

      this.logger.log(
        `[reconcile] ${fn.name}/${asset.filename} ${local ? "hash mismatch" : "missing"} — downloading`
      );

      const data = await this.strategy.read(asset.key);
      await this.preparationService.writeFileBuffer(fn, asset.filename, data);
      changedFilenames.push(asset.filename);
    }

    return changedFilenames;
  }

  async reconcileFunction(
    fn: Function & {_id: ObjectId},
    opts: {allowFallback: boolean} = {allowFallback: true}
  ): Promise<boolean> {
    if (this.artifactManager.enabled) {
      return this.artifactManager.runExclusive(fn.name, async () => {
        const storedAssets = await this.assetService.findByFunction(fn._id);
        if (storedAssets.length === 0) return false;
        await this.syncSources(fn);
        return this.artifactManager.restoreOrBuild(fn, opts);
      });
    }

    const storedAssets = await this.assetService.findByFunction(fn._id);
    if (storedAssets.length === 0) {
      return false;
    }

    const changedFilenames = await this.syncSources(fn);
    if (changedFilenames.length === 0) return false;

    const needsInstall = changedFilenames.some(
      f => f === "package.json" || f === "package-lock.json"
    );
    const needsCompile = changedFilenames.some(f => f === "index.ts" || f === "index.mjs");

    if (needsInstall) {
      await this.preparationService.preparePackageJson(fn);
    }
    if (needsCompile) {
      await this.preparationService.prepareIndex(fn);
    }
    return true;
  }

  async reconcileAll(fns: Array<Function & {_id: ObjectId}>): Promise<void> {
    const limit = this.artifactManager.enabled ? PREBUILT_RECONCILE_CONCURRENCY : fns.length;
    await forEachWithConcurrency(fns, limit, async fn => {
      try {
        await this.reconcileFunction(fn);
      } catch (err) {
        this.logger.error(
          `[reconcile] Failed for function ${fn.name}: ${err instanceof Error ? err.message : err}`
        );
      }
    });
  }
}
