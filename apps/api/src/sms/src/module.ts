import {DynamicModule, Global, Module} from "@nestjs/common";
import {SmsOptions, SMS_OPTIONS, SmsStrategy} from "@spica-server/interface/sms";
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
          provide: SMS_OPTIONS,
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
          inject: [SMS_OPTIONS]
        },
        SmsService
      ],
      exports: [SmsService]
    };
  }
}
