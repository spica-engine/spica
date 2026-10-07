import {
  CreateIndexOptions,
  ExistingIndex,
  IIndexManager,
  IndexDirection,
  IndexSpec
} from "@spica-server/database-driver";
import {MongoDatabase} from "./mongo.database.js";

/**
 * The MongoDB implementation of `IIndexManager` (a Phase 1 leftover; the contract will be implemented on
 * the PG side in Phase 4).
 *
 * The contract's `IndexSpec.keys` field is an **array**, not an object: the field order is meaningful in
 * a compound index (`{a:1,b:-1}` ≠ `{b:-1,a:1}`) and that order cannot be relied on to survive a
 * JSON/BSON round trip (R3). Because in-memory objects do preserve the order, converting with
 * `Object.entries` is safe.
 */
export class MongoIndexManager implements IIndexManager {
  constructor(
    private db: MongoDatabase,
    private collection: string
  ) {}

  /**
   * Index management goes through the raw `Db`: `listIndexes`/`dropIndex` are not in the neutral
   * `ICollection` contract and should not be — the contract's index surface is `IIndexManager` itself.
   */
  private get raw() {
    return this.db.raw.collection(this.collection);
  }

  async list(): Promise<ExistingIndex[]> {
    const indexes = await this.raw.listIndexes().toArray();
    return indexes.map(index => ({
      name: index.name,
      keys: Object.entries(index.key || {}).map(([field, direction]) => ({
        field,
        direction: direction as IndexDirection
      })),
      unique: index.unique,
      expireAfterSeconds: index.expireAfterSeconds
    }));
  }

  create(spec: IndexSpec, options: CreateIndexOptions = {}): Promise<string> {
    const definition = spec.keys.reduce<Record<string, IndexDirection>>(
      (acc, {field, direction}) => {
        acc[field] = direction;
        return acc;
      },
      {}
    );
    // `collation` is a free object in the contract; mongodb expects a type where `locale` is mandatory.
    // It is narrowed at the driver boundary — the capability declaration supports `collation` on Mongo (K-10).
    return this.raw.createIndex(definition, {...options, name: spec.name} as any);
  }

  async drop(name: string): Promise<void> {
    await this.raw.dropIndex(name);
  }

  /** On MongoDB retention is a TTL index; it is read from the index that carries `expireAfterSeconds`. */
  async ttlSeconds(): Promise<number | undefined> {
    const indexes = await this.list();
    return indexes.find(index => index.expireAfterSeconds !== undefined)?.expireAfterSeconds;
  }
}

/** Turns a Mongo index spec object into an order-preserving `IndexSpec.keys`. */
export function toIndexSpec(definition: Record<string, any>, name?: string): IndexSpec {
  return {
    keys: Object.entries(definition).map(([field, direction]) => ({
      field,
      direction: (direction === -1 ? -1 : 1) as IndexDirection
    })),
    name
  };
}
