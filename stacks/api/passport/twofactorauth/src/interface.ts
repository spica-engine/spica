export interface Factor {
  meta: FactorMeta;
  name: string;
  start(): Promise<string>;
  authenticate(payload: any): Promise<boolean>;
  getMeta(): FactorMeta;
}

export interface FactorMeta {
  type: string;
  config: {
    [key: string]: any;
  };
  secret?: string;
  [key: string]: any;
}

export interface FactorSchema {
  type: string;
  title: string;
  description: string;
  config: {
    [key: string]: {type: any; enum?: any[]; value?: any};
  };
  secret?: string;
}

export type TwoFactorAuthSchemaProvider = () => Promise<FactorSchema>;

export const schemas = [
  {
    type: "email",
    title: "E-Mail",
    description: "Security code verification via email.",
    configs: [
      {
        email: {
          type: "string"
        }
      }
    ]
  },
  {
    type: "sms",
    title: "Short Message Service",
    description: "Security code verification via sms.",
    input: [
      {
        address: {
          type: "string"
        }
      }
    ]
  },
  {
    type: "question",
    title: "Question-Answer",
    description: "Security question, answer verification.",
    config: {
      question: {type: "string"},
      answer: {type: "string"}
    }
  },
  {
    type: "totp",
    title: "Time based One Time Password",
    description: "Time based one time password verification via Google Authenticator, Duo etc.",
    input: [
      {
        secret: {
          type: "image"
        }
      }
    ]
  }
];
