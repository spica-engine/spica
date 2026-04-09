export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface SmsOptions {
  strategy: "twilio";
  twilio: TwilioConfig;
}

export const SMS_OPTIONS = "SMS_OPTIONS";
