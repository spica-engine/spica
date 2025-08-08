import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "../../../../../../libs/database";
import {FUNCTION_LOG_OPTIONS, Log, LogOptions} from "../../../../../../libs/interface/function/log";

@Injectable()
export class LogService extends BaseCollection<Log>("function_logs") {
  constructor(db: DatabaseService, @Inject(FUNCTION_LOG_OPTIONS) options: LogOptions) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }
}
