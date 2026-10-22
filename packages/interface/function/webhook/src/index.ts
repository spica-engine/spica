import {Id} from "@spica-server/interface-data";

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

export interface WebhookRepository {
  findAll(): Promise<Webhook[]>;
  findById(id: Id): Promise<Webhook | null>;
  insert(webhook: Webhook): Promise<Webhook>;
  /**
   * Resolves to the replaced webhook, or null when it does not exist.
   */
  replaceById(id: Id, webhook: Webhook): Promise<Webhook | null>;
  /**
   * Resolves to the deleted webhook, or null when it does not exist.
   */
  deleteById(id: Id): Promise<Webhook | null>;
}

export const WEBHOOK_REPOSITORY = Symbol.for("WEBHOOK_REPOSITORY");

export interface WebhookLogRepository {
  insert(log: Log): Promise<Log>;
  deleteById(id: Id): Promise<number>;
  deleteByIds(ids: Id[]): Promise<number>;
}

export const WEBHOOK_LOG_REPOSITORY = Symbol.for("WEBHOOK_LOG_REPOSITORY");
