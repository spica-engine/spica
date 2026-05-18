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
  reconciler: FunctionAssetReconciler,
  assetService: FunctionAssetService,
  tracker: SelfWriteTracker | null,
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
      await reconciler.writeLocalAsset(fn, filename, data);
    }
  }

  try {
    await localOp();
  } catch (localErr) {
    logger.error(
      `[asset-pipeline] Local op failed for ${fn.name}: ${localErr instanceof Error ? localErr.message : localErr}. Restoring…`
    );
    await reconciler.restoreAssets(fn, prevAssets);
    throw localErr;
  }

  // Step 3: upload new assets to storage.
  const uploadedRecords: Array<Omit<FunctionAsset, "functionId" | "_id">> = [];
  const newlyUploadedKeys: string[] = [];

  try {
    for (const {filename, data} of files) {
      // Re-read from disk after localOp (e.g. package.json may have been modified by npm install).
      const localAsset = await reconciler.readLocalAsset(fn, filename);
      const diskData = localAsset ? localAsset.buffer : data;

      const record = await reconciler.uploadAsset(fn.name, filename, diskData);
      newlyUploadedKeys.push(record.key);
      uploadedRecords.push(record);
    }
  } catch (uploadErr) {
    logger.error(
      `[asset-pipeline] Upload failed for ${fn.name}: ${uploadErr instanceof Error ? uploadErr.message : uploadErr}. Restoring…`
    );
    await reconciler.restoreAssets(fn, prevAssets);
    // Best-effort cleanup of partially uploaded objects.
    for (const key of newlyUploadedKeys) {
      reconciler.deleteFromStorage(key).catch(() => {});
    }
    throw uploadErr;
  }

  // Step 4: update metadata in MongoDB.
  try {
    // Stamp before writing so the change-stream on this node suppresses the event.
    if (tracker) {
      for (const record of uploadedRecords) {
        tracker.stamp({
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
    await reconciler.restoreAssets(fn, prevAssets);
    for (const key of newlyUploadedKeys) {
      reconciler.deleteFromStorage(key).catch(() => {});
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
      reconciler.deleteFromStorage(asset.key).catch(e => {
        logger.error(
          `[asset-pipeline] Could not delete remote asset ${asset.key}: ${e instanceof Error ? e.message : e}`
        );
      })
    )
  );
  await assetService.deleteByFunction(fn._id);
}
