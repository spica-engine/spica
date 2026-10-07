import {Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional} from "@nestjs/common";
import {Subscription} from "rxjs";
import {
  FunctionArtifactService,
  FunctionAssetService,
  FunctionService
} from "@spica-server/function-services";
import {FunctionAssetReconciler} from "./asset-reconciler.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";
import {FunctionPreparationService} from "./function-preparation.service.js";
import {PlanExecutor} from "./plan-executor.js";
import {
  ARTIFACT_STAMP_FILENAME,
  FunctionArtifactManager,
  UNAVAILABLE_ARTIFACT_STAMP
} from "./artifact-manager.js";
import {refreshPlan} from "./change.js";
import * as CRUD from "./crud.js";

/**
 * Watches the function_assets change stream and reconciles peer-originated writes.
 *
 * Peer writes (from other nodes) trigger reconciliation + re-prepare, then a
 * worker refresh once this node's copy of the code is ready.
 * Self-writes (from this node) are suppressed via SelfWriteTracker.
 * Delete events trigger directory cleanup on peer replicas.
 *
 * With prebuilt artifacts, asset changes only sync source files. The writer records an artifact
 * after its sources, and that record is what makes peers restore the archive (or build locally
 * when none could be published) and refresh their workers.
 */
@Injectable()
export class FunctionAssetWatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FunctionAssetWatcher.name);
  private subscription: Subscription;
  private artifactSubscription: Subscription;

  constructor(
    private readonly assetService: FunctionAssetService,
    private readonly functionService: FunctionService,
    private readonly reconciler: FunctionAssetReconciler,
    private readonly tracker: SelfWriteTracker,
    private readonly preparationService: FunctionPreparationService,
    private readonly executor: PlanExecutor,
    private readonly artifactService: FunctionArtifactService,
    @Optional() private readonly artifactManager?: FunctionArtifactManager
  ) {}

  onModuleInit() {
    if (this.artifactManager) {
      this.watchArtifacts();
    }

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

            if (this.artifactManager) {
              this.logger.log(
                `[asset-watcher] Peer asset change detected for ${fn.name}/${filename} — syncing sources`
              );
              await this.artifactManager.runExclusive(fn.name, () =>
                this.reconciler.syncSources(fn)
              );
              return;
            }

            this.logger.log(
              `[asset-watcher] Peer asset change detected for ${fn.name}/${filename} — reconciling`
            );

            await this.reconciler.reconcileFunction(fn);
            // The writing replica refreshes only itself, so this is the sole refresh peers get.
            // It must run even when nothing changed locally (shared disk), and must stay local:
            // engine.applyChangePlan would re-broadcast it to every replica.
            await this.executor.apply(refreshPlan(functionId.toHexString()));
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
    if (this.artifactSubscription && !this.artifactSubscription.closed) {
      this.artifactSubscription.unsubscribe();
    }
  }

  private watchArtifacts() {
    const pipeline = [{$match: {operationType: {$in: ["insert", "update", "replace"]}}}];

    this.artifactSubscription = this.artifactService
      .watch(pipeline, {fullDocument: "updateLookup"})
      .subscribe({
        next: async change => {
          try {
            const doc = (change as any).fullDocument;
            const functionId = doc?.functionId;
            if (!functionId) return;

            if (
              this.tracker.isSelfWrite({
                functionId: functionId.toHexString(),
                filename: ARTIFACT_STAMP_FILENAME,
                hash: doc.key ?? UNAVAILABLE_ARTIFACT_STAMP
              })
            ) {
              return;
            }

            const fn = await this.functionService.findOne({_id: functionId});
            if (!fn) return;

            const changed = await this.reconciler.reconcileFunction(fn, {allowFallback: true});
            if (changed) {
              await this.executor.apply(refreshPlan(functionId.toHexString()));
            }
          } catch (err) {
            this.logger.error(
              `[asset-watcher] Error handling artifact change: ${err instanceof Error ? err.message : err}`
            );
          }
        },
        error: err =>
          this.logger.error(
            `[asset-watcher] Artifact change stream error: ${err instanceof Error ? err.message : err}`
          )
      });
  }
}
