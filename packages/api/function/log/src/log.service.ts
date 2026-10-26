import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {FUNCTION_LOG_OPTIONS, Log, LogOptions} from "@spica-server/interface-function-log";

@Injectable()
export class LogService extends BaseCollection<Log>("function_logs") {
  constructor(db: DatabaseService, @Inject(FUNCTION_LOG_OPTIONS) options: LogOptions) {
    super(db, {
      afterInit: () =>
        Promise.all([
          this.upsertTTLIndex(options.expireAfterSeconds),
          this._coll.createIndex({function: 1, _id: -1})
        ])
    });
  }
}
