import {Injectable} from "@nestjs/common";
import {
  BaseCollection,
  ChangeStreamDocument,
  ChangeStreamOptions,
  DatabaseService
} from "@spica-server/database";
import {Observable} from "rxjs";
import {ChangeLog} from "@spica-server/interface/versioncontrol";

@Injectable()
export class ChangeLogService extends BaseCollection<ChangeLog>("changelog") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
