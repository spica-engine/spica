import {Injectable} from "@nestjs/common";
import {filter, map, Observable} from "rxjs";
import {ISyncProcessor, Sync, SyncStatuses} from "@spica-server/interface/versioncontrol";
import {SyncService} from "@spica-server/versioncontrol/services/sync";
import {ObjectId} from "@spica-server/database";
import {ApprovedSync, PendingSync} from "./interface";

@Injectable()
export class SyncProcessor implements ISyncProcessor {
  constructor(private readonly service: SyncService) {}
  push(...syncs: (PendingSync | ApprovedSync)[]): Promise<Sync[]> {
    return this.service.insertMany(syncs).then(() => syncs);
  }

  update(_id: ObjectId, status: SyncStatuses, reason?: string): Promise<Sync> {
    const update: any = {$set: {status, updated_at: new Date()}};
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
      filter(statusFilter)
    );
  }
}
