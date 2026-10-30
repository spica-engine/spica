import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {
  Log,
  Webhook,
  WEBHOOK_OPTIONS,
  WebhookLogRepository,
  WebhookOptions,
  WebhookRepository
} from "@spica-server/interface-function-webhook";
import {webhookLogs, webhooks} from "../../entities/index.js";
import {PostgresExpiry} from "../../expiry/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresWebhookRepository implements WebhookRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  findAll() {
    return this.orm.findMany(webhooks, {}, {orderBy: {_id: "asc"}});
  }

  findById(id: Id) {
    return this.orm.findById(webhooks, id);
  }

  insert(webhook: Webhook) {
    return this.orm.insert(webhooks, webhook);
  }

  replaceById(id: Id, webhook: Webhook) {
    return this.orm.replaceById(webhooks, id, webhook);
  }

  deleteById(id: Id) {
    return this.orm.deleteById(webhooks, id);
  }
}

@Injectable()
export class PostgresWebhookLogRepository implements WebhookLogRepository {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(PostgresExpiry) private readonly expiry: PostgresExpiry,
    @Inject(WEBHOOK_OPTIONS) private readonly retention: WebhookOptions
  ) {}

  async applyExpiry() {
    await this.expiry.expire(webhookLogs, "created_at", this.retention.expireAfterSeconds);
  }

  insert(log: Log) {
    return this.orm.insert(webhookLogs, log);
  }

  async deleteById(id: Id) {
    return (await this.orm.deleteById(webhookLogs, id)) ? 1 : 0;
  }

  async deleteByIds(ids: Id[]) {
    return await this.orm.deleteWhere(webhookLogs, {_id: ids});
  }
}
