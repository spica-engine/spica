import {Id} from "@spica-server/interface-data";
import {ApiKey} from "./index.js";

export interface ApiKeyRepository {
  findById(id: Id): Promise<ApiKey | null>;
  findActiveByKey(key: string): Promise<ApiKey | null>;
  insert(apiKey: ApiKey): Promise<ApiKey>;
  /**
   * Resolves to the updated api key, or null when it does not exist.
   */
  updateById(id: Id, changes: Partial<ApiKey>): Promise<ApiKey | null>;
  replaceById(id: Id, apiKey: ApiKey): Promise<ApiKey | null>;
  deleteById(id: Id): Promise<number>;
  addPolicy(id: Id, policyId: string): Promise<ApiKey | null>;
  removePolicy(id: Id, policyId: string): Promise<ApiKey | null>;
  removePolicyFromAll(policyId: string): Promise<number>;
}

export const APIKEY_REPOSITORY = Symbol.for("APIKEY_REPOSITORY");
