import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Log, Request, Response} from ".";

@Injectable()
export class WebhookLogService extends BaseCollection<Log>("webhook_logs") {
  constructor(db: DatabaseService) {
    super(db);
  }

  insertLog(request: Request, response: any, webhookId: string) {
    let log: Log = {
      webhook: webhookId,
      request: {body: request.body, headers: request.headers, path: request.path},
      response: {
        body: response.body,
        headers: response.headers,
        status: response.status,
        statusText: response.statusText
      }
    };

    this.insertOne(log).catch(err => console.log(err));
  }
}
