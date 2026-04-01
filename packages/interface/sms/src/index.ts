export * from "./options";

export interface SmsSender {
  to: string;
  from?: string;
  body: string;
}

export abstract class SmsStrategy {
  abstract send(sms: SmsSender): Promise<SmsSendResult>;
  abstract validateConfig(): boolean;
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
