import {EntryStatus, Id, ProfilerQuery} from "@spica-server/interface-data";
import {FactorMeta} from "@spica-server/interface-passport-authfactor";
import {Identity} from "./index.js";

/**
 * Inserts and updates reject with DuplicateKeyError when the identifier is taken.
 */
export interface IdentityRepository {
  findById(id: Id, hiddenFields?: {[path: string]: 0}): Promise<Identity | null>;
  findByIdentifier(identifier: string): Promise<Identity | null>;
  findWithAuthFactor(): Promise<Identity[]>;
  insert(identity: Identity): Promise<Identity>;
  /**
   * Inserts the identity unless one with the same identifier exists.
   */
  insertIfMissing(identity: Identity): Promise<number>;
  /**
   * Resolves to the updated identity, or null when it does not exist.
   */
  updateById(id: Id, changes: Partial<Identity>): Promise<Identity | null>;
  updateLoginState(
    identifier: string,
    state: Pick<Identity, "failedAttempts" | "lastLogin">
  ): Promise<void>;
  setAuthFactor(id: Id, authFactor: FactorMeta): Promise<void>;
  /**
   * Resolves to the identity before the factor was removed, or null when it does not exist.
   */
  removeAuthFactor(id: Id): Promise<Identity | null>;
  /**
   * Both resolve to the updated identity without its password fields.
   */
  addPolicy(id: Id, policyId: string): Promise<Identity | null>;
  removePolicy(id: Id, policyId: string): Promise<Identity | null>;
  removePolicyFromAll(policyId: string): Promise<number>;
  deleteById(id: Id): Promise<number>;
  estimatedCount(): Promise<number>;
  status(): Promise<EntryStatus>;
  profilerEntries(query: ProfilerQuery): Promise<unknown[]>;
}

export const IDENTITY_REPOSITORY = Symbol.for("IDENTITY_REPOSITORY");
