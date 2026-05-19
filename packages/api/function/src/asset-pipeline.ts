import {Logger} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {Function} from "@spica-server/interface-function";
import {FunctionAsset, FunctionAssetFilename} from "@spica-server/interface-function-asset-storage";
import {FunctionAssetService} from "@spica-server/function-services";
import {hashBuffer, FunctionAssetReconciler} from "./asset-reconciler.js";
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

/** Returns only files whose content has changed relative to stored metadata. */
function filterChangedFiles(
  files: AssetChangeFile[],
  prevAssets: Array<{filename: FunctionAssetFilename; hash: string}>
): AssetChangeFile[] {
  const prevHashByFilename = new Map(prevAssets.map(a => [a.filename, a.hash]));
  return files.filter(f => hashBuffer(f.data) !== prevHashByFilename.get(f.filename));
}

/** Returns the subset of prevAssets whose filenames appear in the given files. */
function prevAssetsFor(
  files: AssetChangeFile[],
  prevAssets: Array<{filename: FunctionAssetFilename; key: string}>
): Array<{key: string}> {
  const filenames = new Set(files.map(f => f.filename));
  return prevAssets.filter(a => filenames.has(a.filename));
}

/**
 * Full rollback-safe asset-change pipeline.
 *
 * Steps:
 *  1. Fetch previous asset metadata.
 *  2. Execute `op` — performs all disk writes / installs / compiles and returns
 *     the final file contents to persist. On failure → restore disk + re-prepare.
 *  3. Diff against stored hashes; snapshot only keys that will be overwritten.
 *     No-op return when nothing changed.
 *  4. Upload changed files to the storage strategy.
 *     On failure → restore storage, restore disk + re-prepare, abort.
 *  5. Persist updated asset metadata in MongoDB.
 *     On failure → restore storage, restore disk + re-prepare, abort.
 */
export async function applyAssetChange(
  fn: FunctionWithId,
  op: () => Promise<AssetChangeFile[]>,
  reconciler: FunctionAssetReconciler,
  assetService: FunctionAssetService,
  tracker: SelfWriteTracker | null
): Promise<void> {
  // Step 1: fetch previous asset metadata.
  const prevAssets = await assetService.findByFunction(fn._id);

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

  // Step 3: diff against stored hashes; snapshot only what will be overwritten.
  const changedFiles = filterChangedFiles(files, prevAssets);
  const prevBuffers = await reconciler.snapshotAssets(prevAssetsFor(changedFiles, prevAssets));

  if (changedFiles.length === 0) return;

  // Step 4: upload changed files to storage.
  // Both arrays grow incrementally so the catch block rolls back only the
  // keys that actually succeeded before the failure.
  const uploadedRecords: Array<Omit<FunctionAsset, "functionId" | "_id">> = [];
  const uploadedKeys: string[] = [];

  try {
    for (const {filename, data} of changedFiles) {
      const record = await reconciler.uploadAsset(fn.name, filename, data);
      uploadedKeys.push(record.key);
      uploadedRecords.push(record);
    }
  } catch (e) {
    logger.error(`[asset-pipeline] Upload failed for ${fn.name}: ${errMsg(e)}. Restoring…`);
    await reconciler.rollback(fn, prevAssets, uploadedKeys, prevBuffers);
    throw e;
  }

  // Step 5: persist metadata.
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
