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

export function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function assetKey(functionId: ObjectId, filename: string): string {
  return `functions/${functionId.toHexString()}/${filename}`;
}

@Injectable()
export class FunctionAssetReconciler {
  private readonly logger = new Logger(FunctionAssetReconciler.name);

  constructor(
    @Inject(FUNCTION_ASSET_STRATEGY) private readonly strategy: FunctionAssetStrategy,
    @Inject(FUNCTION_ASSET_STORAGE_OPTIONS) private readonly storageOptions: FunctionAssetStorageOptions,
    private readonly assetService: FunctionAssetService,
    @Inject(FUNCTION_OPTIONS) private readonly options: Options
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
  async writeLocalAsset(fn: Function, filename: FunctionAssetFilename, data: Buffer): Promise<void> {
    const filePath = this.getRuntimeFilePath(fn, filename);
    await fs.promises.mkdir(path.dirname(filePath), {recursive: true});
    await fs.promises.writeFile(filePath, data);
  }

  /**
   * Upload a local asset to the configured strategy. Returns the metadata record.
   */
  async uploadAsset(
    functionId: ObjectId,
    filename: FunctionAssetFilename,
    data: Buffer
  ): Promise<Omit<FunctionAsset, "functionId" | "_id">> {
    const key = assetKey(functionId, filename);
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
        this.logger.debug(
          `[reconcile] ${fn.name}/${asset.filename} hash match — skipping`
        );
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
   * Run reconciliation for all provided functions, bounded by the given concurrency.
   * After syncing files, runs engine.installPackages + engine.compile when any
   * file changed. Engine injection is done lazily via a callback to avoid circular
   * dependency.
   */
  async reconcileAll(
    fns: Array<Function & {_id: ObjectId}>,
    prepare: (fn: Function & {_id: ObjectId}) => Promise<void>,
    concurrency = 5
  ): Promise<void> {
    const chunks: Array<Array<Function & {_id: ObjectId}>> = [];
    for (let i = 0; i < fns.length; i += concurrency) {
      chunks.push(fns.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async fn => {
          try {
            const changed = await this.reconcileFunction(fn);
            if (changed) {
              await prepare(fn);
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
}
