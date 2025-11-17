import {
  ChangeHandler,
  ChangeLog,
  ChangeOrigin,
  DocumentChangeApplier,
  DocumentChangeSupplier,
  PendingSync,
  Sync,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import {getSupplier} from "./supplier";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {getApplier} from "./applier";
import {ChangeLogProcessor} from "@spica-server/versioncontrol/processors/changelog";
import {SyncProcessor} from "@spica-server/versioncontrol/processors/sync";
import {JobReducer} from "@spica-server/replication";

export class SyncEngine {
  private readonly changeHandlers: ChangeHandler[] = [];

  constructor(
    private readonly changeLogProcessor: ChangeLogProcessor,
    private readonly syncProcessor: SyncProcessor,
    private readonly repManager: IRepresentativeManager,
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
      this.changeLogProcessor.push(changeLog);
    };

    repHandler.supplier.listen().subscribe(onChange);

    docHandler.supplier.listen().subscribe(onChange);
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
      const meta = {
        _id: sync._id.toString(),
        module: sync.change_log.module,
        subModule: sync.change_log.sub_module,
        resourceId: sync.change_log.resource_id,
        createdAt: sync.created_at
      };

      const job = () => syncHandler(sync);

      if (this.jobReducer) {
        this.jobReducer.do(meta, job);
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

      const meta = {
        _id: changeLog.resource_id,
        module: changeLog.module,
        subModule: changeLog.sub_module,
        resourceId: changeLog.resource_id,
        createdAt: changeLog.created_at
      };

      const job = () => this.syncProcessor.push(sync);

      if (this.jobReducer) {
        this.jobReducer.do(meta, job);
      } else {
        job();
      }
    };
    this.changeLogProcessor.watch().subscribe(changeLogHandler);
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
