import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {Subscription} from "rxjs";
import {FunctionService, FunctionAssetService} from "@spica-server/function-services";
import {FunctionAssetReconciler} from "./asset-reconciler.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";
import {FunctionPreparationService} from "./function-preparation.service.js";
import * as CRUD from "./crud.js";

/**
 * Watches the function_assets change stream and reconciles peer-originated writes.
 *
 * Peer writes (from other nodes) trigger reconciliation + re-prepare.
 * Self-writes (from this node) are suppressed via SelfWriteTracker.
 * Delete events trigger directory cleanup on peer replicas.
 */
@Injectable()
export class FunctionAssetWatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FunctionAssetWatcher.name);
  private subscription: Subscription;

  constructor(
    private readonly assetService: FunctionAssetService,
    private readonly functionService: FunctionService,
    private readonly reconciler: FunctionAssetReconciler,
    private readonly tracker: SelfWriteTracker,
    private readonly preparationService: FunctionPreparationService
  ) {}

  onModuleInit() {
    const pipeline = [
      {
        $match: {
          operationType: {$in: ["insert", "update", "replace", "delete"]}
        }
      }
    ];

    this.subscription = this.assetService
      .watch(pipeline, {
        fullDocument: "updateLookup",
        fullDocumentBeforeChange: "whenAvailable"
      })
      .subscribe({
        next: async change => {
          try {
            const operationType = (change as any).operationType;

            if (operationType === "delete") {
              // fullDocument is null for delete events; use fullDocumentBeforeChange instead.
              const prevDoc = (change as any).fullDocumentBeforeChange;
              // key format: "functions/{functionName}/{filename}"
              const key: string | undefined = prevDoc?.key;
              if (!key) return;

              const functionName = key.split("/")[1];
              if (!functionName) return;

              this.logger.log(
                `[asset-watcher] Peer asset deleted for ${functionName} — removing directory`
              );
              await this.preparationService.deleteFunctionDirectory(functionName);
              return;
            }

            const doc = (change as any).fullDocument;
            const functionId = doc?.functionId;
            const filename = doc?.filename;
            const hash = doc?.hash;

            if (!functionId) return;

            // Skip if this node originated the write.
            if (this.tracker.isSelfWrite({functionId: functionId.toHexString(), filename, hash})) {
              this.logger.debug(
                `[asset-watcher] Suppressing self-write for ${functionId}/${filename}`
              );
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

            await this.reconciler.reconcileFunction(fn);
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
  }
}
