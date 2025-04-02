export interface Policy {
  _id: string;
  name: string;
  description?: string;
  statement: Statement[];
}

export interface Statement {
  action: string;
  resource?:
    | string
    | string[]
    | {
        include: string;
        exclude: string;
      };
  module: string;
}

export type changeFactory = (policyId: string) => Promise<unknown>;

export interface ActionMap {
  action: string;
  indexes: number[];
}

export const APIKEY_POLICY_FINALIZER = Symbol.for("APIKEY_POLICY_FINALIZER");
export const IDENTITY_POLICY_FINALIZER = Symbol.for("IDENTITY_POLICY_FINALIZER");
