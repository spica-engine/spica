import {Injectable} from "@nestjs/common";
import {
  BaseCollection,
  ChangeStreamDocument,
  ChangeStreamOptions,
  DatabaseService
} from "@spica-server/database";
import {Sync} from "@spica-server/interface/versioncontrol";

@Injectable()
export class SyncService extends BaseCollection<Sync>("sync") {
  constructor(db: DatabaseService) {
    super(db, {afterInit: () => this.upsertTTLIndex(30 * 24 * 60 * 60)});
  }
}
