import {
  DeletableById,
  EntryStatus,
  FindableAll,
  FindableById,
  Id,
  Insertable
} from "@spica-server/interface-data";
import {Function} from "./function.js";

export type StoredFunction = Function & {_id: Id};

/**
 * Inserts and updates reject with DuplicateKeyError when the function name is taken.
 */
export interface FunctionRepository
  extends
    FindableAll<StoredFunction>,
    FindableById<StoredFunction>,
    Insertable<Function, StoredFunction>,
    DeletableById<StoredFunction | null> {
  /**
   * Resolves to every function with only its _id, name and language set.
   */
  findSummaries(): Promise<StoredFunction[]>;
  findByName(name: string): Promise<StoredFunction | null>;
  findReferencing(field: "env_vars" | "secrets", resourceId: Id): Promise<StoredFunction[]>;
  /**
   * Sets the given fields and resolves to the function as it was before, or null when it does not
   * exist.
   */
  updateById(id: Id, changes: Partial<Function>): Promise<StoredFunction | null>;
  /**
   * Applies a JSON merge patch that turned the function into patched, and resolves to the updated
   * function, null when it does not exist, or undefined when the patch changes nothing.
   */
  applyMergePatch(
    id: Id,
    patch: object,
    patched: Function
  ): Promise<StoredFunction | null | undefined>;
  replaceById(id: Id, fn: Function): Promise<number>;
  /**
   * The reference updates resolve to the function as it was before, or null when it does not exist.
   */
  addEnvVar(id: Id, envVarId: Id): Promise<StoredFunction | null>;
  removeEnvVar(id: Id, envVarId: Id): Promise<StoredFunction | null>;
  addSecret(id: Id, secretId: Id): Promise<StoredFunction | null>;
  removeSecret(id: Id, secretId: Id): Promise<StoredFunction | null>;
  status(): Promise<EntryStatus>;
}

export const FUNCTION_REPOSITORY = Symbol.for("FUNCTION_REPOSITORY");
