export interface Statement {
  action: string;
  resource: {
    include: string[];
    exclude: string[];
  };
  module: string;
}

export interface PrepareUser {
  (request: any): any;
}

// Since we can not depend on since
export type PolicyResolver<T = unknown> = (ids: string[]) => Promise<T[]>;

/**
 * Since we can not depend on policy service directly cause it would create a circular dependency,
 * we have to depend on a factory function that resolves policy ids to real policy objects
 */
export const POLICY_RESOLVER = Symbol.for("POLICY_RESOLVER");
