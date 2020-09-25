import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {FUNCTION_LOG_OPTIONS, Log, LogOptions} from "./interface";

const COLLECTION_NAME = "function_logs";

@Injectable()
export class LogService extends BaseCollection<Log>(COLLECTION_NAME) {
  constructor(db: DatabaseService, @Inject(FUNCTION_LOG_OPTIONS) options: LogOptions) {
    super(db);
    this.createCollection(COLLECTION_NAME).then(() =>
      this.upsertTTLIndex(options.expireAfterSeconds)
    );
  }
}
