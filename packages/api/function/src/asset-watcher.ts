import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {Subscription} from "rxjs";
import {FunctionService, FunctionAssetService} from "@spica-server/function-services";
import {FunctionAssetReconciler} from "./asset-reconciler.js";
import * as CRUD from "./crud.js";

interface RecentWriteKey {
  functionId: string;
  filename: string;
  hash: string;
}

/**
 * Watches the function_assets change stream and reconciles peer-originated writes.
 *
 * When this node writes a new asset record, it stamps it in the "recently written"
 * set so it can be skipped on the change-stream notification. Peer nodes (or external
 * updates) will not have this stamp, so the reconciler will run for them.
 */
@Injectable()
export class FunctionAssetWatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FunctionAssetWatcher.name);
  private subscription: Subscription;

  /**
   * A small in-memory stamp: key → expiry timestamp (ms).
   * Written via `stampSelfWrite`; checked in the change-stream handler.
   */
  private recentWrites = new Map<string, number>();

  /** How long (ms) a self-write stamp suppresses the change stream reaction. */
  private readonly STAMP_TTL_MS = 10_000;

  /** Registered by FunctionEngine on init to break the circular import. */
  private prepareCallback!: (fn: any) => Promise<void>;

  constructor(
    private readonly assetService: FunctionAssetService,
    private readonly functionService: FunctionService,
    private readonly reconciler: FunctionAssetReconciler
  ) {}

  /**
   * Called by FunctionEngine during its onModuleInit to register the prepare callback.
   * This avoids a circular import: asset-watcher does not import engine.
   */
  registerPrepareCallback(cb: (fn: any) => Promise<void>): void {
    this.prepareCallback = cb;
  }

  onModuleInit() {
    const pipeline = [
      {
        $match: {
          operationType: {$in: ["insert", "update", "replace", "delete"]}
        }
      }
    ];

    this.subscription = this.assetService.watch(pipeline).subscribe({
      next: async change => {
        try {
          const doc = (change as any).fullDocument;
          const functionId = doc?.functionId;
          const filename = doc?.filename;
          const hash = doc?.hash;

          if (!functionId) return;

          // Skip if this node originated the write.
          const stamp = this.buildStampKey({
            functionId: functionId.toHexString(),
            filename,
            hash
          });
          if (this.isRecentSelfWrite(stamp)) {
            this.logger.debug(`[asset-watcher] Suppressing self-write for ${stamp}`);
            return;
          }

          const fn = await this.functionService.findOne({_id: functionId});
          if (!fn) {
            this.logger.warn(
              `[asset-watcher] Change stream: no function found for id ${functionId}`
            );
            return;
          }

          this.logger.log(
            `[asset-watcher] Peer asset change detected for ${fn.name}/${filename} — reconciling`
          );

          const changed = await this.reconciler.reconcileFunction(fn as any);
          if (changed) {
            await this.prepareCallback(fn as any);
          }
        } catch (err) {
          this.logger.error(
            `[asset-watcher] Error handling change: ${err instanceof Error ? err.message : err}`
          );
        }
      },
      error: err =>
        this.logger.error(
          `[asset-watcher] Change stream error: ${err instanceof Error ? err.message : err}`
        )
    });
  }

  onModuleDestroy() {
    if (this.subscription && !this.subscription.closed) {
      this.subscription.unsubscribe();
    }
    this.recentWrites.clear();
  }

  /**
   * Call this immediately before writing asset metadata so the change-stream
   * handler on this node suppresses the resulting event.
   */
  stampSelfWrite(write: RecentWriteKey): void {
    const key = this.buildStampKey(write);
    const expiry = Date.now() + this.STAMP_TTL_MS;
    this.recentWrites.set(key, expiry);

    // Schedule cleanup.
    setTimeout(() => {
      if ((this.recentWrites.get(key) ?? 0) <= Date.now()) {
        this.recentWrites.delete(key);
      }
    }, this.STAMP_TTL_MS + 100).unref();
  }

  private buildStampKey(write: RecentWriteKey): string {
    return `${write.functionId}::${write.filename}::${write.hash}`;
  }

  private isRecentSelfWrite(stamp: string): boolean {
    const expiry = this.recentWrites.get(stamp);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.recentWrites.delete(stamp);
      return false;
    }
    return true;
  }
}
