import {
  DeletableById,
  EntryStatus,
  Id,
  ProfilerQuery,
  Repository,
  UpdatableById
} from "@spica-server/interface-data";
import {FactorMeta} from "@spica-server/interface-passport-authfactor";
import {Identity} from "./index.js";

/**
 * Inserts and updates reject with DuplicateKeyError when the identifier is taken.
 */
export interface IdentityRepository
  extends Repository<Identity>, UpdatableById<Identity>, DeletableById {
  findById(id: Id, hiddenFields?: {[path: string]: 0}): Promise<Identity | null>;
  findByIdentifier(identifier: string): Promise<Identity | null>;
  findWithAuthFactor(): Promise<Identity[]>;
  /**
   * Inserts the identity unless one with the same identifier exists.
   */
  insertIfMissing(identity: Identity): Promise<number>;
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
  estimatedCount(): Promise<number>;
  status(): Promise<EntryStatus>;
  profilerEntries(query: ProfilerQuery): Promise<unknown[]>;
}

export const IDENTITY_REPOSITORY = Symbol.for("IDENTITY_REPOSITORY");
