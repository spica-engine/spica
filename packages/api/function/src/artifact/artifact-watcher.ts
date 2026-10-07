import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {Subscription} from "rxjs";
import {FunctionArtifactService, FunctionService} from "@spica-server/function-services";
import {FunctionAssetReconciler} from "../asset-reconciler.js";
import {refreshPlan} from "../change.js";
import {PlanExecutor} from "../plan-executor.js";
import {ArtifactStore} from "./artifact-store.js";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * A peer records an artifact after its source assets, so this record, not the source change, is
 * what makes a replica restore (or build) the function and refresh its workers.
 */
@Injectable()
export class FunctionArtifactWatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FunctionArtifactWatcher.name);
  private subscription: Subscription | undefined;

  constructor(
    private readonly artifactService: FunctionArtifactService,
    private readonly store: ArtifactStore,
    private readonly functionService: FunctionService,
    private readonly reconciler: FunctionAssetReconciler,
    private readonly executor: PlanExecutor
  ) {}

  onModuleInit() {
    const pipeline = [{$match: {operationType: {$in: ["insert", "update", "replace"]}}}];
    this.subscription = this.artifactService
      .watch(pipeline, {fullDocument: "updateLookup"})
      .subscribe({
        next: change => this.onArtifactRecorded((change as any).fullDocument),
        error: err => this.logger.error(`[artifact-watcher] Change stream error: ${errMsg(err)}`)
      });
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }

  private async onArtifactRecorded(artifact: any) {
    try {
      const functionId = artifact?.functionId;
      if (!functionId || this.store.isSelfWrite(artifact)) return;

      const fn = await this.functionService.findOne({_id: functionId});
      if (!fn) return;

      if (await this.reconciler.reconcileFunction(fn, {allowFallback: true})) {
        await this.executor.apply(refreshPlan(functionId.toHexString()));
      }
    } catch (err) {
      this.logger.error(`[artifact-watcher] Error handling artifact change: ${errMsg(err)}`);
    }
  }
}
