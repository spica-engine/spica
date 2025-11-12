import {
  ChangeHandler,
  ChangeLogProcessor,
  ChangeOrigin,
  DocumentChangeApplier,
  DocumentChangeSupplier,
  SyncProcessor,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import {getSupplier} from "./supplier";
import {IIRepresentativeManager} from "@spica-server/interface/representative";
import {getApplier} from "./applier";

export class SyncEngine {
  changeHandler: ChangeHandler[];
  constructor(
    private suppliers: DocumentChangeSupplier[],
    private appliers: DocumentChangeApplier[],
    private changeLogProcessor: ChangeLogProcessor,
    private syncProcessor: SyncProcessor,
    private repManager: IIRepresentativeManager
  ) {
    const changeHandlersForReps = this.appliers.map(applier => {
      const repSupplier = getSupplier(this.repManager, applier);
      return {
        supplier: repSupplier,
        applier: applier,
        moduleMeta: {module: applier.module, subModule: applier.subModule},
        origin: ChangeOrigin.REPRESENTATIVE
      } as ChangeHandler;
    });

    const changeHandlersForDocs = this.suppliers.map(supplier => {
      const repApplier = getApplier(repManager, supplier);
      return {
        supplier: supplier,
        applier: repApplier,
        moduleMeta: {module: supplier.module, subModule: supplier.subModule},
        origin: ChangeOrigin.DOCUMENT
      } as ChangeHandler;
    });

    const changeHandlers = [...changeHandlersForReps, ...changeHandlersForDocs];

    this.syncProcessor.watch().subscribe(sync => {
      // switch origin to apply change
      // put something better here.
      sync.change_log.origin = ChangeOrigin.DOCUMENT
        ? ChangeOrigin.REPRESENTATIVE
        : ChangeOrigin.DOCUMENT;

      const handler = changeHandlers.find(
        handler =>
          handler.moduleMeta.module === sync.change_log.module &&
          handler.moduleMeta.subModule === sync.change_log.sub_module
      );

      if (!handler) {
        console.error("No handler found for sync", sync);
      }

      handler.applier.apply(sync.change_log).then(result => {
        return syncProcessor.update(sync, result.status, result.reason);
      });
    });

    this.changeLogProcessor.watch().subscribe(changeLog => {
      const sync = {
        change_log: changeLog,
        status: SyncStatuses.PENDING,
        created_at: new Date(),
        updated_at: new Date()
      };
      syncProcessor.push(sync);
    });

    changeHandlers.forEach(handler => {
      handler.supplier.listen().subscribe(changeLog => {
        changeLogProcessor.push(changeLog);
      });
    });
  }
}
