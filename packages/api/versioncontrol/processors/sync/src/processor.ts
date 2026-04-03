import {Injectable} from "@nestjs/common";
import {filter, map, Observable} from "rxjs";
import {
  ApprovedSync,
  AutoApproveSyncConfig,
  ChangeInitiator,
  ChangeOrigin,
  ISyncProcessor,
  PendingSync,
  Sync,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import {SyncService} from "@spica-server/versioncontrol-services-sync";
import {ObjectId} from "@spica-server/database";
import {VCConfigService} from "./config.service.js";

@Injectable()
export class SyncProcessor implements ISyncProcessor {
  constructor(
    private readonly service: SyncService,
    private readonly vcConfigService: VCConfigService
  ) {}

  async push(...syncs: (PendingSync | ApprovedSync)[]): Promise<Sync[]> {
    const autoApproveConfig = await this.vcConfigService.getAutoApproveSyncConfig();

    syncs = syncs.map(sync => this.applyAutoApprove(sync, autoApproveConfig));

    return this.service.insertMany(syncs).then(() => syncs);
  }

  private applyAutoApprove(
    sync: PendingSync | ApprovedSync,
    config: AutoApproveSyncConfig
  ): PendingSync | ApprovedSync {
    if (sync.change_log.initiator === ChangeInitiator.INTERNAL) {
      return {...sync, status: SyncStatuses.APPROVED};
    }

    if (sync.change_log.initiator === ChangeInitiator.EXTERNAL) {
      const origin = sync.change_log.origin;
      if (
        (origin === ChangeOrigin.DOCUMENT && config.document) ||
        (origin === ChangeOrigin.REPRESENTATIVE && config.representative)
      ) {
        return {...sync, status: SyncStatuses.APPROVED};
      }
    }

    return sync;
  }

  update(_id: ObjectId, status: SyncStatuses, reason?: string): Promise<Sync> {
    const update: {$set: Partial<Sync>} = {$set: {status, updated_at: new Date()}};
    if (reason) {
      update.$set.reason = reason;
    }
    return this.service.findOneAndUpdate({_id}, update, {returnDocument: "after"});
  }

  watch(status?: SyncStatuses): Observable<Sync> {
    let statusFilter = sync => sync;

    if (status) {
      statusFilter = sync => sync.status === status;
    }

    return this.service.watch([], {fullDocument: "updateLookup"}).pipe(
      map(change => change["fullDocument"]),
      filter(sync => Boolean(sync)),
      filter(statusFilter)
    );
  }
}
