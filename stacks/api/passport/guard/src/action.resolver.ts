/**
 * Since we can not depend on policy service directly cause it would create a circular dependency,
 * we have to depend on a factory function that resolves policy ids to real policy objects
 */
export const ACTION_RESOLVER = Symbol.for("ACTION_RESOLVER");


// Since we can not depend on since
export type ActionResolver<T = unknown> = (ids: string[]) => Promise<T[]>;