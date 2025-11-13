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
  constructor(
    private readonly suppliers: DocumentChangeSupplier[],
    private readonly appliers: DocumentChangeApplier[],
    private readonly changeLogProcessor: ChangeLogProcessor,
    private readonly syncProcessor: SyncProcessor,
    private readonly repManager: IIRepresentativeManager
  ) {
    const changeHandlersForReps = this.buildChangeHandlersForReps();
    const changeHandlersForDocs = this.buildChangeHandlersForDocs();

    const changeHandlers = [...changeHandlersForReps, ...changeHandlersForDocs];

    this.syncProcessor.watch().subscribe(sync => {
      const handler = this.findChangeHandlerOfSync(sync, changeHandlers);

      if (!handler) {
        console.error("No handler found for sync", sync);
        return;
      }

      handler.applier.apply(sync.change_log).then(result => {
        return syncProcessor.update(sync._id, result.status, result.reason);
      });
    });

    this.changeLogProcessor.watch().subscribe(changeLog => {
      const sync: PendingSync = this.generateSyncFromChangeLog(
        changeLog,
        SyncStatuses.PENDING
      ) as PendingSync;
      syncProcessor.push(sync);
    });

    for (const handler of changeHandlers) {
      handler.supplier.listen().subscribe(changeLog => {
        changeLogProcessor.push(changeLog);
      });
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

  private findChangeHandlerOfSync(
    sync: Sync,
    changeHandlers: ChangeHandler[]
  ): ChangeHandler | undefined {
    return changeHandlers.find(
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
