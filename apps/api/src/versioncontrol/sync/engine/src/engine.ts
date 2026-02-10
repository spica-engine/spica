import {
  ChangeHandler,
  ChangeLog,
  ChangeOrigin,
  DocumentChangeApplier,
  DocumentChangeSupplier,
  PendingSync,
  Sync,
  SyncStatuses,
  VC_REPRESENTATIVE_MANAGER
} from "@spica-server/interface/versioncontrol";
import {getSupplier} from "./supplier";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {getApplier} from "./applier";
import {ChangeLogProcessor} from "@spica-server/versioncontrol/processors/changelog";
import {SyncProcessor} from "@spica-server/versioncontrol/processors/sync";
import {JobReducer} from "@spica-server/replication";
import {Inject, Optional} from "@nestjs/common";

export class SyncEngine {
  private readonly changeHandlers: ChangeHandler[] = [];

  constructor(
    @Inject()
    private readonly changeLogProcessor: ChangeLogProcessor,
    @Inject()
    private readonly syncProcessor: SyncProcessor,
    @Inject(VC_REPRESENTATIVE_MANAGER)
    private readonly repManager: IRepresentativeManager,
    @Optional()
    @Inject()
    private jobReducer?: JobReducer
  ) {
    this.registerSyncProcessor();
    this.registerChangeLogProcessor();
  }

  public registerChangeHandler(supplier: DocumentChangeSupplier, applier: DocumentChangeApplier) {
    const repHandler: ChangeHandler = this.getRepChangeHandler(applier);

    const docHandler: ChangeHandler = this.getDocChangeHandler(supplier);

    this.changeHandlers.push(repHandler, docHandler);

    const onChange = (changeLog: ChangeLog) => {
      const job = () => this.changeLogProcessor.push(changeLog);

      if (this.jobReducer) {
        const jobId = `${changeLog.module}-${changeLog.sub_module}-${changeLog.origin}-${changeLog.resource_id}`;
        this.jobReducer.do({...changeLog, _id: jobId}, job).catch(error => {
          console.error("SyncEngine Change Handler Job reducer failed:", error);
        });
      } else {
        job();
      }
    };

    repHandler.supplier.listen().subscribe(onChange);

    docHandler.supplier.listen().subscribe(onChange);
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

    this.syncProcessor.watch(SyncStatuses.APPROVED).subscribe(sync => {
      const job = () => syncHandler(sync);

      if (this.jobReducer) {
        this.jobReducer.do({...sync, _id: sync._id.toString()}, job).catch(error => {
          console.error("SyncEngine SyncProcessor Job reducer failed:", error);
        });
      } else {
        job();
      }
    });
  }

  private registerChangeLogProcessor() {
    const changeLogHandler = (changeLog: ChangeLog) => {
      const sync: PendingSync = this.generateSyncFromChangeLog(
        changeLog,
        SyncStatuses.PENDING
      ) as PendingSync;

      const job = () => this.syncProcessor.push(sync);

      if (this.jobReducer) {
        this.jobReducer.do({...sync, _id: changeLog._id.toString()}, job).catch(error => {
          console.error("SyncEngine ChangeLogProcessor Job reducer failed:", error);
        });
      } else {
        job();
      }
    };
    this.changeLogProcessor.watch().subscribe(changeLogHandler);
  }

  private getDocChangeHandler(supplier: DocumentChangeSupplier): ChangeHandler {
    return {
      supplier: supplier,
      applier: getApplier(this.repManager, supplier),
      moduleMeta: {module: supplier.module, subModule: supplier.subModule},
      origin: ChangeOrigin.DOCUMENT
    };
  }

  private getRepChangeHandler(applier: DocumentChangeApplier): ChangeHandler {
    return {
      supplier: getSupplier(this.repManager, applier),
      applier: applier,
      moduleMeta: {module: applier.module, subModule: applier.subModule},
      origin: ChangeOrigin.REPRESENTATIVE
    };
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
