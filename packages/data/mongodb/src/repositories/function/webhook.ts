import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {
  Log,
  Webhook,
  WEBHOOK_OPTIONS,
  WebhookLogRepository,
  WebhookOptions,
  WebhookRepository
} from "@spica-server/interface-function-webhook";

@Injectable()
export class MongoWebhookRepository
  extends BaseCollection<Webhook>("webhook")
  implements WebhookRepository
{
  constructor(database: DatabaseService) {
    super(database);
  }

  findAll() {
    return this.find();
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  insert(webhook: Webhook) {
    return this.insertOne(webhook);
  }

  replaceById(id: Id, webhook: Webhook) {
    return this.findOneAndReplace({_id: id}, webhook, {returnDocument: ReturnDocument.AFTER});
  }

  deleteById(id: Id) {
    return this.findOneAndDelete({_id: id});
  }
}

@Injectable()
export class MongoWebhookLogRepository
  extends BaseCollection<Log>("webhook_logs")
  implements WebhookLogRepository
{
  constructor(db: DatabaseService, @Inject(WEBHOOK_OPTIONS) options: WebhookOptions) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }

  insert(log: Log) {
    return this.insertOne(log);
  }

  deleteById(id: Id) {
    return this.deleteOne({_id: id});
  }

  deleteByIds(ids: Id[]) {
    return this.deleteMany({_id: {$in: ids}});
  }
}
