import {
  DeletableById,
  Id,
  ReplaceableById,
  Repository,
  UpdatableById
} from "@spica-server/interface-data";
import {ApiKey} from "./index.js";

export interface ApiKeyRepository
  extends Repository<ApiKey>, UpdatableById<ApiKey>, ReplaceableById<ApiKey>, DeletableById {
  findActiveByKey(key: string): Promise<ApiKey | null>;
  addPolicy(id: Id, policyId: string): Promise<ApiKey | null>;
  removePolicy(id: Id, policyId: string): Promise<ApiKey | null>;
  removePolicyFromAll(policyId: string): Promise<number>;
}

export const APIKEY_REPOSITORY = Symbol.for("APIKEY_REPOSITORY");
