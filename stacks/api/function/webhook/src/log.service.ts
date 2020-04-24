import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Log} from "@spica-server/function/webhook";

@Injectable()
export class WebhookLogService extends BaseCollection<Log>("webhook_logs") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
