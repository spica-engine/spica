import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";
import {Log, WEBHOOK_OPTIONS, WebhookOptions} from "./interface";

@Injectable()
export class WebhookLogService extends BaseCollection<Log>("webhook_logs") {
  constructor(
    db: DatabaseService,
    client: MongoClient,
    @Inject(WEBHOOK_OPTIONS) options: WebhookOptions
  ) {
    super(db, client, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }
}
