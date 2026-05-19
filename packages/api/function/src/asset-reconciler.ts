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
   * Restore a set of assets from remote storage back to local disk.
   * Used during rollback after a failed pipeline operation.
   */
  private async restoreAssets(
    fn: Function,
    prevAssets: Array<{key: string; filename: FunctionAssetFilename}>
  ): Promise<void> {
    for (const asset of prevAssets) {
      try {
        const data = await this.strategy.read(asset.key);
        await this.writeLocalAsset(fn, asset.filename, data);
      } catch (e) {
        this.logger.error(
          `[rollback] Could not restore ${fn.name}/${asset.filename}: ${e instanceof Error ? e.message : e}`
        );
      }
    }
  }

  /**
   * Re-prepare a function after rollback: reinstall packages and recompile.
   * Ensures the runtime (compiled artifact + node_modules) matches the files
   * that were just restored to disk.
   */
  private async prepare(fn: Function): Promise<void> {
    return this.preparationService.prepare(fn);
  }

  /**
   * Read and cache buffer content from storage for each pre-existing asset.
   * Enables safe rollback of in-place-overwritten keys during a failed upload.
   */
  async snapshotAssets(prevAssets: Array<{key: string}>): Promise<Map<string, Buffer>> {
    const map = new Map<string, Buffer>();
    await Promise.all(
      prevAssets.map(async asset => {
        try {
          map.set(asset.key, await this.readFromStorage(asset.key));
        } catch {
          // Asset in metadata but missing from storage — will be deleted on rollback.
        }
      })
    );
    return map;
  }

  /**
   * Restore disk files from storage then re-prepare the runtime.
   * Used when only the operation step failed (storage was not touched).
   * Skips prepare when prevAssets is empty — no known-good state to restore against.
   */
  async rollbackDisk(
    fn: Function,
    prevAssets: Array<{key: string; filename: FunctionAssetFilename}>
  ): Promise<void> {
    await this.restoreAssets(fn, prevAssets);
    if (prevAssets.length > 0) {
      await this.prepare(fn).catch(e => {
        this.logger.error(`[rollback] Post-rollback prepare failed for ${fn.name}: ${errMsg(e)}`);
      });
    }
  }

  /**
   * Full rollback: restore storage keys to their pre-upload state, then
   * restore disk + re-prepare. Pre-existing keys are re-uploaded with the
   * old buffer; new keys are deleted.
   *
   * Must restore storage before disk so restoreAssets reads the correct content.
   */
  async rollback(
    fn: Function,
    prevAssets: Array<{key: string; filename: FunctionAssetFilename}>,
    uploadedKeys: string[],
    prevBuffers: Map<string, Buffer>
  ): Promise<void> {
    await Promise.all(
      uploadedKeys.map(key => {
        const old = prevBuffers.get(key);
        return old !== undefined
          ? this.writeToStorage(key, old).catch(() => {})
          : this.deleteFromStorage(key).catch(() => {});
      })
    );
    await this.rollbackDisk(fn, prevAssets);
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
   * Downloads and restores any file whose hash doesn't match (or is missing).
   * Returns true if any file was updated (caller should re-prepare the function).
   */
  async reconcileFunction(fn: Function & {_id: ObjectId}): Promise<boolean> {
    const storedAssets = await this.assetService.findByFunction(fn._id);
    if (storedAssets.length === 0) {
      // No metadata recorded; nothing to reconcile.
      return false;
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

    return anyChanged;
  }

  /**
   * Run reconciliation for all provided functions.
   * After syncing files, runs installPackages + compile when any file changed.
   */
  async reconcileAll(fns: Array<Function & {_id: ObjectId}>): Promise<void> {
    await Promise.all(
      fns.map(async fn => {
        try {
          const changed = await this.reconcileFunction(fn);
          if (changed) {
            await this.preparationService.prepare(fn);
          }
        } catch (err) {
          this.logger.error(
            `[reconcile] Failed for function ${fn.name}: ${err instanceof Error ? err.message : err}`
          );
        }
      })
    );
  }
}
