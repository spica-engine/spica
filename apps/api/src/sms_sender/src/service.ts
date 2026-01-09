import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {SmsSender, SmsStrategy, SmsSendResult} from "@spica-server/interface/sms_sender";

@Injectable()
export class SmsSenderService extends BaseCollection<SmsSender>("sms_sender") {
  private strategies: Map<string, SmsStrategy> = new Map();

  constructor(database: DatabaseService) {
    super(database, {
      afterInit: () => Promise.all([this.createIndex({to: 1}), this.createIndex({service: 1})])
    });
  }
  registerStrategy(strategy: SmsStrategy): void {
    this.strategies.set(strategy.providerName, strategy);
  }

  async sendSms(sms: SmsSender): Promise<SmsSendResult> {
    const strategy = this.strategies.get(sms.service);

    if (!strategy) {
      throw new Error(
        `SMS service "${sms.service}" is not supported. Available services: ${this.getSupportedServices().join(", ")}`
      );
    }

    if (!strategy.validateConfig()) {
      throw new Error(
        `SMS service "${sms.service}" is not properly configured. Please check the configuration.`
      );
    }

    const result = await strategy.send(sms);

    await this.insertOne({
      to: sms.to,
      from: sms.from,
      body: sms.body,
      service: sms.service,
      messageId: result.messageId,
      status: result.success ? "sent" : "failed",
      error: result.error,
      sentAt: new Date()
    });

    return result;
  }

  getStrategy(serviceName: string): SmsStrategy | undefined {
    return this.strategies.get(serviceName);
  }

  getSupportedServices(): string[] {
    return Array.from(this.strategies.keys());
  }

  isServiceSupported(serviceName: string): boolean {
    return this.strategies.has(serviceName);
  }
}
