import {Logger} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {Function} from "@spica-server/interface-function";
import {FunctionAsset, FunctionAssetFilename} from "@spica-server/interface-function-asset-storage";
import {FunctionAssetService} from "@spica-server/function-services";
import {FunctionAssetReconciler} from "./asset-reconciler.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";

const logger = new Logger("FunctionAssetPipeline");

type FunctionWithId = Function & {_id: ObjectId};

export interface AssetChangeFile {
  filename: FunctionAssetFilename;
  data: Buffer;
}

/** Format any caught value as a string for use in log messages. */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Read and cache buffer content from storage for each pre-existing asset.
 * Enables safe rollback of in-place-overwritten keys during a failed upload.
 */
async function snapshotPrevBuffers(
  prevAssets: Array<{key: string}>,
  reconciler: FunctionAssetReconciler
): Promise<Map<string, Buffer>> {
  const map = new Map<string, Buffer>();
  await Promise.all(
    prevAssets.map(async asset => {
      try {
        map.set(asset.key, await reconciler.readFromStorage(asset.key));
      } catch {
        // Asset in metadata but missing from storage — will be deleted on rollback.
      }
    })
  );
  return map;
}

/**
 * Restore storage keys to their pre-upload state.
 * Pre-existing keys → re-upload old buffer (undo in-place overwrite).
 * New keys          → delete from storage.
 *
 * Must be called BEFORE restoreDiskAndPrepare so that restoreAssets reads
 * the correct old content from storage when writing back to disk.
 */
async function restoreStorageKeys(
  uploadedKeys: string[],
  prevBuffers: Map<string, Buffer>,
  reconciler: FunctionAssetReconciler
): Promise<void> {
  await Promise.all(
    uploadedKeys.map(key => {
      const old = prevBuffers.get(key);
      return old !== undefined
        ? reconciler.writeToStorage(key, old).catch(() => {})
        : reconciler.deleteFromStorage(key).catch(() => {});
    })
  );
}

/**
 * Restore disk files from storage then re-prepare the runtime
 * (reinstall packages + recompile) so it is consistent with the restored files.
 * Skipped when prevAssets is empty — no known-good state to prepare against.
 */
async function restoreDiskAndPrepare(
  fn: FunctionWithId,
  prevAssets: Array<{key: string; filename: FunctionAssetFilename}>,
  reconciler: FunctionAssetReconciler
): Promise<void> {
  await reconciler.restoreAssets(fn, prevAssets);
  if (prevAssets.length > 0) {
    await reconciler.prepare(fn).catch(e => {
      logger.error(`[asset-pipeline] Post-rollback prepare failed for ${fn.name}: ${errMsg(e)}`);
    });
  }
}

/**
 * Full rollback-safe asset-change pipeline.
 *
 * Steps:
 *  1. Snapshot prev metadata + storage buffers (rollback reference).
 *  2. Execute `op` — it performs all disk writes / installs / compiles and
 *     returns the final file contents to persist. On failure → restore disk
 *     + re-prepare, abort.
 *  3. Upload assets to the storage strategy.
 *     On failure → restore storage, restore disk + re-prepare, abort.
 *  4. Persist asset metadata in MongoDB.
 *     On failure → restore storage, restore disk + re-prepare, abort.
 */
export async function applyAssetChange(
  fn: FunctionWithId,
  op: () => Promise<AssetChangeFile[]>,
  reconciler: FunctionAssetReconciler,
  assetService: FunctionAssetService,
  tracker: SelfWriteTracker | null
): Promise<void> {
  // Step 1: snapshot prev metadata + storage buffers.
  const prevAssets = await assetService.findByFunction(fn._id);
  const prevBuffers = await snapshotPrevBuffers(prevAssets, reconciler);

  // Step 2: execute the operation — the callback handles all disk writes and
  // returns the final file contents ready for upload.
  let files: AssetChangeFile[];
  try {
    files = await op();
  } catch (e) {
    logger.error(`[asset-pipeline] Op failed for ${fn.name}: ${errMsg(e)}. Restoring…`);
    await restoreDiskAndPrepare(fn, prevAssets, reconciler); // storage untouched
    throw e;
  }

  // Step 3: upload to storage.
  // Both arrays grow incrementally so the catch block can roll back only the
  // keys that actually succeeded before the failure.
  const uploadedRecords: Array<Omit<FunctionAsset, "functionId" | "_id">> = [];
  const uploadedKeys: string[] = [];

  try {
    for (const {filename, data} of files) {
      const record = await reconciler.uploadAsset(fn.name, filename, data);
      uploadedKeys.push(record.key);
      uploadedRecords.push(record);
    }
  } catch (e) {
    logger.error(`[asset-pipeline] Upload failed for ${fn.name}: ${errMsg(e)}. Restoring…`);
    await restoreStorageKeys(uploadedKeys, prevBuffers, reconciler);
    await restoreDiskAndPrepare(fn, prevAssets, reconciler);
    throw e;
  }

  // Step 4: persist metadata.
  try {
    if (tracker) {
      for (const r of uploadedRecords) {
        tracker.stamp({functionId: fn._id.toHexString(), filename: r.filename, hash: r.hash});
      }
    }
    await assetService.upsertMany(fn._id, uploadedRecords);
  } catch (e) {
    logger.error(
      `[asset-pipeline] Metadata update failed for ${fn.name}: ${errMsg(e)}. Restoring…`
    );
    await restoreStorageKeys(uploadedKeys, prevBuffers, reconciler);
    await restoreDiskAndPrepare(fn, prevAssets, reconciler);
    throw e;
  }
}

/**
 * Delete all stored assets for a function from both storage and metadata.
 * Called during CRUD.remove after the local directory has been wiped.
 */
export async function applyAssetDelete(
  fn: FunctionWithId,
  reconciler: FunctionAssetReconciler,
  assetService: FunctionAssetService
): Promise<void> {
  const prevAssets = await assetService.findByFunction(fn._id);
  await Promise.all(
    prevAssets.map(asset =>
      reconciler.deleteFromStorage(asset.key).catch(e => {
        logger.error(`[asset-pipeline] Could not delete remote asset ${asset.key}: ${errMsg(e)}`);
      })
    )
  );
  await assetService.deleteByFunction(fn._id);
}
