import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "../../../../../../libs/database";
import {Log, WEBHOOK_OPTIONS, WebhookOptions} from "../../../../../../libs/interface/function/webhook";

@Injectable()
export class WebhookLogService extends BaseCollection<Log>("webhook_logs") {
  constructor(db: DatabaseService, @Inject(WEBHOOK_OPTIONS) options: WebhookOptions) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }
}
