import {Inject, Injectable, Logger} from "@nestjs/common";
import {createHash} from "crypto";
import fs from "fs";
import path from "path";
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
import {Function, Options, FUNCTION_OPTIONS} from "@spica-server/interface-function";
import {FunctionPreparationService} from "./function-preparation.service.js";

export function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function assetKey(functionName: string, filename: string): string {
  return `functions/${functionName}/${filename}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

@Injectable()
export class FunctionAssetReconciler {
  private readonly logger = new Logger(FunctionAssetReconciler.name);

  constructor(
    @Inject(FUNCTION_ASSET_STRATEGY) private readonly strategy: FunctionAssetStrategy,
    @Inject(FUNCTION_ASSET_STORAGE_OPTIONS)
    private readonly storageOptions: FunctionAssetStorageOptions,
    private readonly assetService: FunctionAssetService,
    @Inject(FUNCTION_OPTIONS) private readonly options: Options,
    private readonly preparationService: FunctionPreparationService
  ) {}

  private getRuntimeFilePath(fn: Function, filename: FunctionAssetFilename): string {
    return path.join(this.options.root, fn.name, filename);
  }

  /**
   * Read a file from the local runtime disk and return its buffer + sha256 hash.
   * Returns null if the file does not exist.
   */
  async readLocalAsset(
    fn: Function,
    filename: FunctionAssetFilename
  ): Promise<{buffer: Buffer; hash: string} | null> {
    const filePath = this.getRuntimeFilePath(fn, filename);
    try {
      const buffer = await fs.promises.readFile(filePath);
      return {buffer, hash: hashBuffer(buffer)};
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }

  /**
   * Write buffer to runtime disk for a given function + filename.
   */
  async writeLocalAsset(
    fn: Function,
    filename: FunctionAssetFilename,
    data: Buffer
  ): Promise<void> {
    const filePath = this.getRuntimeFilePath(fn, filename);
    await fs.promises.mkdir(path.dirname(filePath), {recursive: true});
    await fs.promises.writeFile(filePath, data);
  }

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
      await this.writeLocalAsset(fn, prevAsset.filename, data);
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
    const prepareStep =
      prevAsset.filename === "package.json"
        ? () => this.preparationService.preparePackageJson(fn)
        : () => this.preparationService.prepareIndex(fn);
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
   * Reconcile a single function: compare local file hashes to stored metadata.
   * Downloads and restores any file whose hash doesn't match (or is missing),
   * then re-prepares the function if any file changed.
   */
  async reconcileFunction(fn: Function & {_id: ObjectId}): Promise<void> {
    const storedAssets = await this.assetService.findByFunction(fn._id);
    if (storedAssets.length === 0) {
      // No metadata recorded; nothing to reconcile.
      return;
    }

    let anyChanged = false;

    for (const asset of storedAssets) {
      const local = await this.readLocalAsset(fn, asset.filename);

      if (local && local.hash === asset.hash) {
        this.logger.debug(`[reconcile] ${fn.name}/${asset.filename} hash match — skipping`);
        continue;
      }

      this.logger.log(
        `[reconcile] ${fn.name}/${asset.filename} ${local ? "hash mismatch" : "missing"} — downloading`
      );

      const data = await this.strategy.read(asset.key);
      await this.writeLocalAsset(fn, asset.filename, data);
      anyChanged = true;
    }

    if (anyChanged) {
      await this.preparationService.prepare(fn);
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
