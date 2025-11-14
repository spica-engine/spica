import {
  ChangeHandler,
  ChangeLog,
  ChangeOrigin,
  DocumentChangeApplier,
  DocumentChangeSupplier,
  Sync,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import {getSupplier} from "./supplier";
import {IIRepresentativeManager} from "@spica-server/interface/representative";
import {getApplier} from "./applier";
import {ChangeLogProcessor} from "@spica-server/versioncontrol/processors/changelog";
import {SyncProcessor} from "@spica-server/versioncontrol/processors/sync";
import {PendingSync} from "@spica-server/versioncontrol/processors/sync/src/interface";

export class SyncEngine {
  private readonly changeHandlers: ChangeHandler[] = [];

  constructor(
    private readonly suppliers: DocumentChangeSupplier[],
    private readonly appliers: DocumentChangeApplier[],
    private readonly changeLogProcessor: ChangeLogProcessor,
    private readonly syncProcessor: SyncProcessor,
    private readonly repManager: IIRepresentativeManager
  ) {
    this.defineChangeHandlers();

    this.registerSyncProcessor();
    this.registerChangeLogProcessor();
    this.registerChangeHandlers();
  }

  private registerSyncProcessor() {
    const syncHandler = async (sync: Sync) => {
      const handler = this.findChangeHandlerOfSync(sync);

      if (!handler) {
        this.syncProcessor.update(sync._id, SyncStatuses.FAILED, "No handler found for this sync.");
        return;
      }

      await this.syncProcessor.update(sync._id, SyncStatuses.IN_PROGRESS);
      const result = await handler.applier.apply(sync.change_log);
      return this.syncProcessor.update(sync._id, result.status, result.reason);
    };

    this.syncProcessor.watch(SyncStatuses.APPROVED).subscribe(syncHandler);
  }

  private registerChangeLogProcessor() {
    const changeLogHandler = (changeLog: ChangeLog) => {
      const sync: PendingSync = this.generateSyncFromChangeLog(
        changeLog,
        SyncStatuses.PENDING
      ) as PendingSync;
      this.syncProcessor.push(sync);
    };
    this.changeLogProcessor.watch().subscribe(changeLogHandler);
  }

  private defineChangeHandlers() {
    const repHandlers = this.buildChangeHandlersForReps();
    const docHandlers = this.buildChangeHandlersForDocs();
    this.changeHandlers.push(...repHandlers, ...docHandlers);
  }

  private registerChangeHandlers() {
    const changeHandler = (changeLog: ChangeLog) => this.changeLogProcessor.push(changeLog);

    for (const handler of this.changeHandlers) {
      handler.supplier.listen().subscribe(changeHandler);
    }
  }

  private buildChangeHandlersForReps(): ChangeHandler[] {
    return this.appliers.map(applier => {
      const repSupplier = getSupplier(this.repManager, applier);
      return {
        supplier: repSupplier,
        applier: applier,
        moduleMeta: {module: applier.module, subModule: applier.subModule},
        origin: ChangeOrigin.REPRESENTATIVE
      } as ChangeHandler;
    });
  }

  private buildChangeHandlersForDocs(): ChangeHandler[] {
    return this.suppliers.map(supplier => {
      const repApplier = getApplier(this.repManager, supplier);
      return {
        supplier: supplier,
        applier: repApplier,
        moduleMeta: {module: supplier.module, subModule: supplier.subModule},
        origin: ChangeOrigin.DOCUMENT
      } as ChangeHandler;
    });
  }

  private findChangeHandlerOfSync(sync: Sync): ChangeHandler | undefined {
    return this.changeHandlers.find(
      handler =>
        handler.moduleMeta.module === sync.change_log.module &&
        handler.moduleMeta.subModule === sync.change_log.sub_module &&
        handler.origin === sync.change_log.origin
    );
  }

  private generateSyncFromChangeLog(changeLog: ChangeLog, status: SyncStatuses): Sync {
    return {
      change_log: changeLog,
      status: status,
      created_at: new Date(),
      updated_at: new Date()
    };
  }
}
