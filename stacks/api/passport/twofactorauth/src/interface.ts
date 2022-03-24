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
