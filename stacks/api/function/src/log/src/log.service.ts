import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";
import {FUNCTION_LOG_OPTIONS, Log, LogOptions} from "./interface";

@Injectable()
export class LogService extends BaseCollection<Log>("function_logs") {
  constructor(
    db: DatabaseService,
    client: MongoClient,
    @Inject(FUNCTION_LOG_OPTIONS) options: LogOptions
  ) {
    super(db, client, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }
}
