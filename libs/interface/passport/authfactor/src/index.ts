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
    [key: string]: {type: string; enum?: any[]};
  };
}

export type AuthFactorSchemaProvider = () => Promise<FactorSchema>;

export interface TotpFactorMeta extends FactorMeta {
  type: "totp";
  secret: string;
}
