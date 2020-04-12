import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Log, Request, Response} from ".";

@Injectable()
export class WebhookLogService extends BaseCollection<Log>("webhook_logs") {
  constructor(db: DatabaseService) {
    super(db);
  }

  insertLog(request: Request, response: Response, webhookId: string) {
    let log: Log = {
      webhook: webhookId,
      request: request,
      response: response
    };

    this.insertOne(log).catch(err => console.log(err));
  }
}
