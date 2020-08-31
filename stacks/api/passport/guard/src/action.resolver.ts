/**
 * Since we can not depend on policy service directly cause it would create a circular dependency,
 * we have to depend on a factory function that resolves policy ids to real policy objects
 */
export const POLICY_RESOLVER = Symbol.for("POLICY_RESOLVER");

// Since we can not depend on since
export type PolicyResolver<T = unknown> = (ids: string[]) => Promise<T[]>;
