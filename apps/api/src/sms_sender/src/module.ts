import {DynamicModule, Global, Module} from "@nestjs/common";
import {SmsOptions, SMS_SENDER_OPTIONS, SmsStrategy} from "@spica-server/interface/sms_sender";
import {SmsService} from "./service";
import {TwilioStrategy} from "./strategy";

@Global()
@Module({})
export class SmsSenderModule {
  static forRoot(options: SmsOptions): DynamicModule {
    return {
      module: SmsSenderModule,
      controllers: [],
      providers: [
        {
          provide: SMS_SENDER_OPTIONS,
          useValue: options
        },
        {
          provide: SmsStrategy,
          useFactory: (options: SmsOptions) => {
            switch (options.strategy) {
              case "twilio":
                return new TwilioStrategy(
                  options.twilio.accountSid,
                  options.twilio.authToken,
                  options.twilio.fromNumber
                );
              default:
                throw new Error(`Unknown SMS strategy: ${options.strategy}`);
            }
          },
          inject: [SMS_SENDER_OPTIONS]
        },
        SmsService
      ],
      exports: [SmsService]
    };
  }
}
