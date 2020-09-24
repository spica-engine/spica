import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Log, WEBHOOK_OPTIONS, WebhookOptions} from "./interface";

const COLLECTION_NAME = "webhook_logs";

@Injectable()
export class WebhookLogService extends BaseCollection<Log>(COLLECTION_NAME) {
  constructor(db: DatabaseService, @Inject(WEBHOOK_OPTIONS) options: WebhookOptions) {
    super(db);
    this.createCollection(COLLECTION_NAME).then(_ =>
      this.upsertTTLIndex(options.expireAfterSeconds)
    );
  }
}
