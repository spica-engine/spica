import fs from "fs";
import path from "path";
import {Logger} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {Function, Options} from "@spica-server/interface-function";
import {FunctionAsset, FunctionAssetFilename} from "@spica-server/interface-function-asset-storage";
import {FunctionAssetService} from "@spica-server/function-services";
import {FunctionAssetReconciler, assetKey, hashBuffer} from "./asset-reconciler.js";
import {FunctionAssetWatcher} from "./asset-watcher.js";

const logger = new Logger("FunctionAssetPipeline");

type FunctionWithId = Function & {_id: ObjectId};

/**
 * Read a source file from the local runtime disk for a given function.
 * Returns null if the file doesn't exist.
 */
async function readRuntimeFile(
  options: Options,
  fn: FunctionWithId,
  filename: FunctionAssetFilename
): Promise<Buffer | null> {
  const filePath = path.join(options.root, fn.name, filename);
  return fs.promises.readFile(filePath).catch(e => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
}

/**
 * Write a buffer to a source file in the local runtime disk.
 */
async function writeRuntimeFile(
  options: Options,
  fn: FunctionWithId,
  filename: FunctionAssetFilename,
  data: Buffer
): Promise<void> {
  const filePath = path.join(options.root, fn.name, filename);
  await fs.promises.mkdir(path.dirname(filePath), {recursive: true});
  await fs.promises.writeFile(filePath, data);
}

/**
 * Download and write each asset from the previous metadata snapshot back to
 * runtime disk. Used for rollback after a failed operation.
 */
async function restoreFromAssets(
  reconciler: FunctionAssetReconciler,
  options: Options,
  fn: FunctionWithId,
  prevAssets: FunctionAsset[]
): Promise<void> {
  for (const asset of prevAssets) {
    try {
      const data = await reconciler["strategy"].read(asset.key);
      await writeRuntimeFile(options, fn, asset.filename, data);
    } catch (e) {
      logger.error(
        `[rollback] Could not restore ${fn.name}/${asset.filename}: ${e instanceof Error ? e.message : e}`
      );
    }
  }
}

export interface AssetChangeFile {
  filename: FunctionAssetFilename;
  data: Buffer;
}

/**
 * Full rollback-safe asset-change pipeline.
 *
 * Steps (per spec):
 *  1. Snapshot prev metadata (rollback ref).
 *  2. Apply local disk writes + run `localOp` (install/compile).
 *     On failure → restore from prevAssets, abort.
 *  3. Upload new assets to storage strategy.
 *     On failure → restore from prevAssets + best-effort delete uploaded keys, abort.
 *  4. Update metadata in MongoDB.
 *     On failure → restore from prevAssets + best-effort delete uploaded keys, abort.
 *  5. Stamp self-writes in watcher (suppress change-stream self-reaction).
 */
export async function applyAssetChange(
  fn: FunctionWithId,
  files: AssetChangeFile[],
  options: Options,
  reconciler: FunctionAssetReconciler,
  assetService: FunctionAssetService,
  watcher: FunctionAssetWatcher | null,
  localOp: () => Promise<void>
): Promise<void> {
  // Step 1: snapshot prev metadata.
  const prevAssets = await assetService.findByFunction(fn._id);

  // Step 2: apply local disk writes + execute install/compile.
  // Skip writing if data is empty (length === 0) — this signals a capture-only
  // placeholder where the localOp itself produces the file (e.g. npm install
  // updates package.json).  Writing an empty buffer would corrupt the file.
  for (const {filename, data} of files) {
    if (data.length > 0) {
      await writeRuntimeFile(options, fn, filename, data);
    }
  }

  try {
    await localOp();
  } catch (localErr) {
    logger.error(
      `[asset-pipeline] Local op failed for ${fn.name}: ${localErr instanceof Error ? localErr.message : localErr}. Restoring…`
    );
    await restoreFromAssets(reconciler, options, fn, prevAssets);
    throw localErr;
  }

  // Step 3: upload new assets to storage.
  const uploadedRecords: Array<Omit<FunctionAsset, "functionId" | "_id">> = [];
  const newlyUploadedKeys: string[] = [];

  try {
    for (const {filename, data} of files) {
      // Re-read from disk after localOp (e.g. package.json may have been modified by npm install).
      const diskData = (await readRuntimeFile(options, fn, filename)) ?? data;
      const hash = hashBuffer(diskData);
      const key = assetKey(fn.name, filename);

      await reconciler["strategy"].write(key, diskData);
      newlyUploadedKeys.push(key);

      uploadedRecords.push({
        filename,
        key,
        hash,
        size: diskData.byteLength,
        uploadDate: new Date(),
        strategy: reconciler["storageOptions"].strategy
      });
    }
  } catch (uploadErr) {
    logger.error(
      `[asset-pipeline] Upload failed for ${fn.name}: ${uploadErr instanceof Error ? uploadErr.message : uploadErr}. Restoring…`
    );
    await restoreFromAssets(reconciler, options, fn, prevAssets);
    // Best-effort cleanup of partially uploaded objects.
    for (const key of newlyUploadedKeys) {
      reconciler["strategy"].delete(key).catch(() => {});
    }
    throw uploadErr;
  }

  // Step 4: update metadata in MongoDB.
  try {
    // Stamp before writing so the change-stream on this node suppresses the event.
    if (watcher) {
      for (const record of uploadedRecords) {
        watcher.stampSelfWrite({
          functionId: fn._id.toHexString(),
          filename: record.filename,
          hash: record.hash
        });
      }
    }
    await assetService.upsertMany(fn._id, uploadedRecords);
  } catch (metaErr) {
    logger.error(
      `[asset-pipeline] Metadata update failed for ${fn.name}: ${metaErr instanceof Error ? metaErr.message : metaErr}. Restoring…`
    );
    await restoreFromAssets(reconciler, options, fn, prevAssets);
    for (const key of newlyUploadedKeys) {
      reconciler["strategy"].delete(key).catch(() => {});
    }
    throw metaErr;
  }
}

/**
 * Delete all stored assets for a function from both storage and metadata.
 * Called during CRUD.remove after the local dir has been wiped.
 */
export async function applyAssetDelete(
  fn: FunctionWithId,
  reconciler: FunctionAssetReconciler,
  assetService: FunctionAssetService
): Promise<void> {
  const prevAssets = await assetService.findByFunction(fn._id);
  await Promise.all(
    prevAssets.map(asset =>
      reconciler["strategy"].delete(asset.key).catch(e => {
        logger.error(
          `[asset-pipeline] Could not delete remote asset ${asset.key}: ${e instanceof Error ? e.message : e}`
        );
      })
    )
  );
  await assetService.deleteByFunction(fn._id);
}
