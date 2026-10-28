import {
  DeletableById,
  EntryStatus,
  Id,
  ProfilerQuery,
  Repository,
  UpdatableById
} from "@spica-server/interface-data";
import {FactorMeta} from "@spica-server/interface-passport-authfactor";
import {User, UserVerification} from "./index.js";

/**
 * Inserts and updates reject with DuplicateKeyError when the username, email or phone is taken.
 */
export interface UserRepository extends Repository<User>, UpdatableById<User>, DeletableById {
  findById(id: Id): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findWithAuthFactor(): Promise<User[]>;
  /**
   * Inserts the user unless one with the same username exists.
   */
  insertIfMissing(user: User): Promise<number>;
  /**
   * Sets the given fields, which may be dotted paths into the user, without reading the user.
   */
  setFields(id: Id, fields: Record<string, unknown>): Promise<void>;
  /**
   * Sets the given attributes and resolves to the updated user, or null when it does not exist.
   */
  setAttributes(id: Id, attributes: Record<string, unknown>): Promise<User | null>;
  updateLoginState(
    username: string,
    state: Pick<User, "failedAttempts" | "lastLogin">
  ): Promise<void>;
  setAuthFactor(id: Id, authFactor: FactorMeta): Promise<void>;
  /**
   * Resolves to the user before the factor was removed, or null when it does not exist.
   */
  removeAuthFactor(id: Id): Promise<User | null>;
  /**
   * Both resolve to the updated user without its password fields.
   */
  addPolicy(id: Id, policyId: string): Promise<User | null>;
  removePolicy(id: Id, policyId: string): Promise<User | null>;
  removePolicyFromAll(policyId: string): Promise<number>;
  status(): Promise<EntryStatus>;
  profilerEntries(query: ProfilerQuery): Promise<unknown[]>;
}

export const USER_REPOSITORY = Symbol.for("USER_REPOSITORY");

export interface VerificationTarget {
  userId: Id;
  strategy: string;
  purpose: string;
}

export interface VerificationRepository {
  /**
   * Marks the unused verification of the target as used and resolves to it as it was before.
   */
  consume(target: VerificationTarget & {provider: string}): Promise<UserVerification | null>;
  /**
   * Stores the code on the target's unused verification, creating it if needed, and resolves to
   * the verification with its request count.
   */
  upsertPending(
    target: VerificationTarget,
    pending: {destination: string; provider: string; code: string}
  ): Promise<UserVerification & {_id: Id}>;
  deleteById(id: Id): Promise<void>;
}

export const VERIFICATION_REPOSITORY = Symbol.for("VERIFICATION_REPOSITORY");
