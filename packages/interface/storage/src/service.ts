import {StorageObjectMeta} from "./body";

export type StorageResponse = StorageObjectMeta;

export interface PaginatedStorageResponse {
  meta: {
    total: number;
  };
  data: StorageResponse[];
}
