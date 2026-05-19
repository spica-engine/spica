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
  const prevBuffers = await reconciler.snapshotAssets(prevAssets);

  // Step 2: execute the operation — the callback handles all disk writes and
  // returns the final file contents ready for upload.
  let files: AssetChangeFile[];
  try {
    files = await op();
  } catch (e) {
    logger.error(`[asset-pipeline] Op failed for ${fn.name}: ${errMsg(e)}. Restoring…`);
    await reconciler.rollbackDisk(fn, prevAssets);
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
    await reconciler.rollback(fn, prevAssets, uploadedKeys, prevBuffers);
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
    await reconciler.rollback(fn, prevAssets, uploadedKeys, prevBuffers);
    throw e;
  }
}
