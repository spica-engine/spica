import {Logger} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {Function} from "@spica-server/interface-function";
import {FunctionAssetFilename} from "@spica-server/interface-function-asset-storage";
import {FunctionAssetService} from "@spica-server/function-services";
import {hashBuffer, assetKey, FunctionAssetReconciler} from "./asset-reconciler.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";

const logger = new Logger("FunctionAssetPipeline");

type FunctionWithId = Function & {_id: ObjectId};

/** Format any caught value as a string for use in log messages. */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Rollback-safe pipeline for a single asset change.
 *
 * Steps:
 *  1. Fetch the previous metadata record for this specific file from MongoDB.
 *  2. Execute `op` — performs all disk writes / installs / compiles and returns
 *     the new file buffer. On failure → restore only this file from storage.
 *  3. Compare hash against stored record. No-op return when unchanged.
 *  4. Snapshot the existing storage object (if file already existed) for rollback.
 *  5. Upload the new buffer to the storage strategy.
 *     On failure → restore storage key, restore disk + re-prepare, abort.
 *  6. Persist updated asset metadata in MongoDB.
 *     On failure → restore storage key, restore disk + re-prepare, abort.
 */
export async function applyAssetChange(
  fn: FunctionWithId,
  filename: FunctionAssetFilename,
  op: () => Promise<Buffer>,
  reconciler: FunctionAssetReconciler,
  assetService: FunctionAssetService,
  tracker: SelfWriteTracker | null
): Promise<void> {
  // Step 1: fetch previous metadata for this file only.
  const prevAsset = await assetService.findByFilename(fn._id, filename);

  // Step 2: execute the operation.
  let data: Buffer;
  try {
    data = await op();
  } catch (e) {
    logger.error(`[asset-pipeline] Op failed for ${fn.name}/${filename}: ${errMsg(e)}. Restoring…`);
    await reconciler.rollbackDisk(fn, prevAsset ?? null);
    throw e;
  }

  // Step 3: no-op when content is identical to what is already stored.
  if (prevAsset && hashBuffer(data) === prevAsset.hash) return;

  // Step 4: snapshot existing storage object so we can restore it on rollback.
  const prevBuffer = await reconciler.snapshotAsset(prevAsset ?? null);

  // Step 5: upload to storage.
  let record: Awaited<ReturnType<typeof reconciler.uploadAsset>>;
  try {
    record = await reconciler.uploadAsset(fn.name, filename, data);
  } catch (e) {
    logger.error(
      `[asset-pipeline] Upload failed for ${fn.name}/${filename}: ${errMsg(e)}. Restoring…`
    );
    await reconciler.rollback(fn, prevAsset ?? null, assetKey(fn.name, filename), prevBuffer);
    throw e;
  }

  // Step 6: persist metadata.
  try {
    tracker?.stamp({
      functionId: fn._id.toHexString(),
      filename: record.filename,
      hash: record.hash
    });
    await assetService.upsertAsset(fn._id, filename, {
      key: record.key,
      hash: record.hash,
      size: record.size,
      uploadDate: record.uploadDate,
      strategy: record.strategy
    });
  } catch (e) {
    logger.error(
      `[asset-pipeline] Metadata update failed for ${fn.name}/${filename}: ${errMsg(e)}. Restoring…`
    );
    await reconciler.rollback(fn, prevAsset ?? null, record.key, prevBuffer);
    throw e;
  }
}
