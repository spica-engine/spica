import {ObjectId} from "@spica-server/database";
export * from "./options";

export interface SmsSender {
  _id?: ObjectId;
  to: string;
  from?: string;
  body: string;
  service: string;
  messageId?: string;
  status?: "sent" | "failed" | "pending";
  error?: string;
  sentAt?: Date;
}

export abstract class SmsStrategy {
  abstract send(sms: SmsSender): Promise<SmsSendResult>;
  abstract validateConfig(): boolean;
  abstract get providerName(): string;
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}
