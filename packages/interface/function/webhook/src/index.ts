import {
  DeletableById,
  ExpiringRepository,
  FindableAll,
  Id,
  Insertable,
  ReplaceableById,
  Repository
} from "@spica-server/interface-data";

export interface Webhook {
  _id?: Id;
  title: string;
  url: string;
  body: string;
  trigger: Trigger;
}

export interface WebhookOptions {
  expireAfterSeconds: number;
}

export interface Trigger {
  name: "database";
  active?: boolean;
  options: {
    collection: string;
    type: "INSERT" | "UPDATE" | "REPLACE" | "DELETE";
  };
}

export interface Log {
  _id?: Id;
  webhook: string;
  succeed: boolean;
  content: {
    error?: string;
    request?: Request;
    response?: Response;
  };
  created_at: Date;
}

export interface Request {
  headers: {
    [key: string]: string;
  };
  url: string;
  body: string;
}

interface Response {
  status: number;
  statusText: string;
  body: string;
  headers: {
    [key: string]: string[];
  };
}

export enum ChangeKind {
  Added = 0,
  Removed = 1,
  Updated = 2
}

export interface TargetChange {
  kind: ChangeKind;
  target: string;
  webhook?: Omit<Webhook, "_id">;
}

export const WEBHOOK_OPTIONS = Symbol.for("WEBHOOK_OPTIONS");

export interface WebhookRepository
  extends
    FindableAll<Webhook>,
    Repository<Webhook>,
    ReplaceableById<Webhook>,
    DeletableById<Webhook | null> {}

export const WEBHOOK_REPOSITORY = Symbol.for("WEBHOOK_REPOSITORY");

export interface WebhookLogRepository extends Insertable<Log>, DeletableById, ExpiringRepository {
  deleteByIds(ids: Id[]): Promise<number>;
}

export const WEBHOOK_LOG_REPOSITORY = Symbol.for("WEBHOOK_LOG_REPOSITORY");
