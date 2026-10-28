import {DeletableById, FindableAll, Id, Repository} from "@spica-server/interface-data";
import {Policy} from "./index.js";

export interface PolicyRepository extends FindableAll<Policy>, Repository<Policy>, DeletableById {
  /**
   * Resolves to the number of modified policies, which is 0 when nothing changed.
   */
  replaceById(id: Id, policy: Policy): Promise<number>;
}

export const POLICY_REPOSITORY = Symbol.for("POLICY_REPOSITORY");
