import {Id} from "@spica-server/interface-data";
import {StorageObjectMeta} from "./body.js";

export interface StorageBrowseSpec {
  resourceFilter?: {include?: string[]; exclude?: string[]} | object;
  path?: string;
  /**
   * The client-supplied filter, passed through unchanged.
   */
  filter?: object;
  sort?: object;
  skip?: number;
  limit?: number;
}

export interface StorageRepository {
  /**
   * Rejects with DuplicateKeyError when an object with the name exists.
   */
  insert(object: StorageObjectMeta): Promise<StorageObjectMeta>;
  /**
   * Resolves to the objects with their ids; rejects with DuplicateKeyError when a name exists.
   */
  insertAll(objects: StorageObjectMeta[]): Promise<StorageObjectMeta[]>;
  findById(id: Id): Promise<StorageObjectMeta | null>;
  findByName(name: string): Promise<StorageObjectMeta | null>;
  findByIds(ids: Id[]): Promise<StorageObjectMeta[]>;
  findByNames(names: string[]): Promise<StorageObjectMeta[]>;
  /**
   * Lists the objects directly under the path that the resource filter allows.
   */
  browse(spec: StorageBrowseSpec): Promise<StorageObjectMeta[]>;
  /**
   * Resolves to the objects whose names start with the prefix.
   */
  findByNamePrefix(prefix: string): Promise<StorageObjectMeta[]>;
  totalSize(): Promise<number>;
  updateById(id: Id, fields: Partial<StorageObjectMeta>): Promise<void>;
  /**
   * Replaces the prefix in the names of the object with that name and of the objects under it.
   */
  renamePrefix(oldName: string, newName: string): Promise<void>;
  deleteById(id: Id): Promise<StorageObjectMeta | null>;
  deleteByName(name: string): Promise<StorageObjectMeta | null>;
  deleteByIds(ids: Id[]): Promise<number>;
  deleteByNamePrefix(prefix: string): Promise<number>;
}

export const STORAGE_REPOSITORY = Symbol.for("STORAGE_REPOSITORY");
