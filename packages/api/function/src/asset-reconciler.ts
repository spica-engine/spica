import {Inject, Injectable, Logger} from "@nestjs/common";
import {createHash} from "crypto";
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

export function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function assetKey(functionName: string, filename: string): string {
  return `functions/${functionName}/${filename}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const BACKFILL_CONCURRENCY = 4;

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
    private readonly tracker: SelfWriteTracker
  ) {}

  /**
   * Upload a local asset to the configured strategy. Returns the metadata record.
   */
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

  /**
   * Read a raw buffer from the configured storage strategy.
   */
  private async readFromStorage(key: string): Promise<Buffer> {
    return this.strategy.read(key);
  }

  /**
   * Write a raw buffer to the configured storage strategy.
   * Used during rollback to restore pre-existing objects that were overwritten.
   */
  private async writeToStorage(key: string, data: Buffer): Promise<void> {
    return this.strategy.write(key, data);
  }

  /**
   * Delete a key from the configured storage strategy.
   */
  private async deleteFromStorage(key: string): Promise<void> {
    return this.strategy.delete(key);
  }

  /**
   * Restore a single asset from remote storage back to local disk.
   * No-op when prevAsset is null (file did not previously exist).
   */
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

  /**
   * Read and cache the buffer of a single pre-existing asset from storage.
   * Returns null when prevAsset is null (new file — nothing to snapshot).
   */
  async snapshotAsset(prevAsset: {key: string} | null): Promise<Buffer | null> {
    if (!prevAsset) return null;
    try {
      return await this.readFromStorage(prevAsset.key);
    } catch {
      // Asset in metadata but missing from storage — treat as absent.
      return null;
    }
  }

  /**
   * Restore a single file from storage to disk, then run the targeted prepare
   * step for that filename (compile for index files, install for package.json).
   * No-op when prevAsset is null — nothing to restore.
   */
  async rollbackDisk(
    fn: Function,
    prevAsset: {key: string; filename: FunctionAssetFilename} | null
  ): Promise<void> {
    if (!prevAsset) return;
    await this.restoreAsset(fn, prevAsset);
    let prepareStep: () => Promise<void>;
    switch (prevAsset.filename) {
      case "package.json":
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

  /**
   * Full rollback for a single-file upload failure: restore the storage key to
   * its pre-upload state (re-write old buffer or delete if it was a new file),
   * then restore disk + re-prepare.
   *
   * Storage must be restored before disk so restoreAsset reads the correct content.
   */
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

  /**
   * Delete all stored assets for a function from both storage and metadata.
   */
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
  }

  /**
   * Upload the local files of functions that have no stored assets (created before asset storage
   * existed), so a replica without this persistent disk can still restore them. Files that already
   * have a record are never read or uploaded: the stored copy stays authoritative.
   */
  async backfill(fns: Array<Function & {_id: ObjectId}>): Promise<void> {
    if (this.storageOptions.strategy == "default") return;

    const lost: string[] = [];
    await forEachWithConcurrency(fns, BACKFILL_CONCURRENCY, async fn => {
      try {
        const hasCode = await this.backfillFunction(fn);
        if (!hasCode) lost.push(fn.name);
      } catch (e) {
        this.logger.error(`[backfill] Failed for function ${fn.name}: ${errMsg(e)}`);
      }
    });

    if (lost.length) {
      this.logger.warn(
        `[backfill] No stored assets and no local files for: ${lost.join(", ")}. Their code cannot be restored.`
      );
    }
  }

  private async backfillFunction(fn: Function & {_id: ObjectId}): Promise<boolean> {
    const records = await this.assetService.findByFunction(fn._id);
    if (records.length > 0) return true;

    const uploaded: Array<Omit<FunctionAsset, "functionId" | "_id">> = [];
    for (const filename of [this.preparationService.indexFilename(fn), "package.json"] as const) {
      const data = await this.preparationService.readFileBuffer(fn, filename);
      if (!data) continue;
      uploaded.push(await this.uploadAsset(fn.name, filename, data));
    }
    if (uploaded.length == 0) return false;

    // A function with any record is skipped from then on, so a partially recorded back-fill would
    // never be completed. Records are written only after every object is stored, and removed again
    // if writing them fails, leaving the function with no records to be retried on the next start.
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
    return true;
  }

  /**
   * Reconcile a single function: compare local file hashes to stored metadata.
   * Downloads and restores any file whose hash doesn't match (or is missing),
   * then re-prepares the function if any file changed.
   *
   * All changed assets are written to disk first, then prepare steps run in
   * deterministic order (package.json install before index compile) and each
   * step runs at most once regardless of how many assets changed.
   */
  async reconcileFunction(fn: Function & {_id: ObjectId}): Promise<void> {
    const storedAssets = await this.assetService.findByFunction(fn._id);
    if (storedAssets.length === 0) {
      // No metadata recorded; nothing to reconcile.
      return;
    }

    const changedFilenames: FunctionAssetFilename[] = [];

    // Phase 1: restore all changed assets to disk before running any prepare step.
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

    if (changedFilenames.length === 0) return;

    // Phase 2: run prepare steps in deterministic order — install before compile.
    // Each step runs at most once even if multiple assets changed.
    const needsInstall = changedFilenames.includes("package.json");
    const needsCompile = changedFilenames.some(f => f === "index.ts" || f === "index.mjs");
    const unknownFilenames = changedFilenames.filter(
      f => f !== "package.json" && f !== "index.ts" && f !== "index.mjs"
    );

    if (needsInstall) {
      await this.preparationService.preparePackageJson(fn);
    }
    if (needsCompile) {
      await this.preparationService.prepareIndex(fn);
    }
    for (const filename of unknownFilenames) {
      this.logger.warn(
        `[reconcile] Unknown asset filename "${filename}" for function ${fn.name} — skipping prepare`
      );
    }
  }

  /**
   * Run reconciliation for all provided functions.
   * After syncing files, runs installPackages + compile when any file changed.
   */
  async reconcileAll(fns: Array<Function & {_id: ObjectId}>): Promise<void> {
    await Promise.all(
      fns.map(async fn => {
        try {
          await this.reconcileFunction(fn);
        } catch (err) {
          this.logger.error(
            `[reconcile] Failed for function ${fn.name}: ${err instanceof Error ? err.message : err}`
          );
        }
      })
    );
  }
}
