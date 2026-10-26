import {Id} from "@spica-server/interface-data";
import {Policy} from "./index.js";

export interface PolicyRepository {
  findAll(): Promise<Policy[]>;
  findById(id: Id): Promise<Policy | null>;
  insert(policy: Policy): Promise<Policy>;
  /**
   * Resolves to the number of modified policies, which is 0 when nothing changed.
   */
  replaceById(id: Id, policy: Policy): Promise<number>;
  deleteById(id: Id): Promise<number>;
}

export const POLICY_REPOSITORY = Symbol.for("POLICY_REPOSITORY");
