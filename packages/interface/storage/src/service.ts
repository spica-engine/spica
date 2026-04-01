import {StorageObjectMeta} from "./body.js";

export type StorageResponse = StorageObjectMeta;

export interface PaginatedStorageResponse {
  meta: {
    total: number;
  };
  data: StorageResponse[];
}
