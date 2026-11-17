import {Id} from "./id.js";

export interface FindableById<T> {
  findById(id: Id): Promise<T | null>;
}

export interface FindableAll<T> {
  findAll(): Promise<T[]>;
}

export interface Insertable<T, Stored = T> {
  insert(entity: T): Promise<Stored>;
}

export interface Repository<T, Stored = T> extends FindableById<Stored>, Insertable<T, Stored> {}

/**
 * Sets the given fields and resolves to the updated entity, or null when it does not exist.
 * Repositories that resolve to the entity as it was before document it where they extend this.
 */
export interface UpdatableById<T, Result = T | null> {
  updateById(id: Id, changes: Partial<T>): Promise<Result>;
}

/**
 * Replaces the entity with the id and resolves to the replaced entity, or null when it does not
 * exist.
 */
export interface ReplaceableById<T, Result = T | null> {
  replaceById(id: Id, entity: T): Promise<Result>;
}

/**
 * Resolves to the number of deleted entities, or to the deleted entity or null when the result
 * type says so.
 */
export interface DeletableById<Result = number> {
  deleteById(id: Id): Promise<Result>;
}
