import {Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {Subscription} from "rxjs";
import {CHANGE_FEED, ChangeFeed} from "@spica-server/interface-data";
import {FUNCTION_ASSET_COLLECTION} from "@spica-server/interface-function-asset-storage";
import {FUNCTION_REPOSITORY, FunctionRepository} from "@spica-server/interface-function";
import {FunctionAssetReconciler} from "./asset-reconciler.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";
import {FunctionPreparationService} from "./function-preparation.service.js";
import {PlanExecutor} from "./plan-executor.js";
import {FunctionDependents} from "./function-dependents.js";

@Injectable()
export class FunctionAssetWatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FunctionAssetWatcher.name);
  private subscription: Subscription;

  constructor(
    @Inject(CHANGE_FEED) private readonly feed: ChangeFeed,
    @Inject(FUNCTION_REPOSITORY) private readonly functions: FunctionRepository,
    private readonly reconciler: FunctionAssetReconciler,
    private readonly tracker: SelfWriteTracker,
    private readonly preparationService: FunctionPreparationService,
    private readonly executor: PlanExecutor,
    private readonly dependents: FunctionDependents
  ) {}

  onModuleInit() {
    this.subscription = this.feed
      .watch(FUNCTION_ASSET_COLLECTION, {
        operations: ["insert", "update", "replace", "delete"],
        document: "current",
        beforeChange: "whenAvailable"
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
            if (this.tracker.isSelfWrite({functionId: functionId.toString(), filename, hash})) {
              this.logger.debug(
                `[asset-watcher] Suppressing self-write for ${functionId}/${filename}`
              );
              return;
            }

            const fn = await this.functions.findById(functionId);
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
            await this.executor.apply(await this.dependents.refreshPlan(fn));
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
