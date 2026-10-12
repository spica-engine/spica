import {Db} from "mongodb";
import {
  CollectionOptions,
  DriverCapabilities,
  ICollection,
  IIndexManager,
  ISupportsIndexManager
} from "@spica-server/database-driver";
import {DatabaseService} from "../../src/database.service.js";
import {MongoCollection} from "./mongo.collection.js";
import {mongoCapabilities} from "./mongo.capabilities.js";
import {MongoIndexManager} from "./mongo.index-manager.js";

/**
 * The MongoDB implementation of `DatabaseService` (Phase 6 slice 6a).
 *
 * **It removes the cast that had been standing since Phase 1.** Until now `database.module.ts` was doing
 * `client.db(name) as DatabaseService`; that is, there was no subclass instance behind the token at all,
 * mongodb's `Db` had been forced into a neutral type. Now there is a real instance and every member of the
 * neutral surface is satisfied explicitly here.
 *
 * `raw` exposes mongodb's `Db` **inside this package only**: Mongo-specific work such as
 * `MongoCollection`'s profile collection needs it. `packages/api` does not see this field, because the
 * type injected from there is `DatabaseService`.
 */
export class MongoDatabase extends DatabaseService implements ISupportsIndexManager {
  readonly capabilities: DriverCapabilities = mongoCapabilities;

  constructor(readonly raw: Db) {
    super();
  }

  get databaseName(): string {
    return this.raw.databaseName;
  }

  collection<T = any>(name: string, options: CollectionOptions = {}): ICollection<T> {
    return new MongoCollection<T>(this, name, options as any);
  }

  async createCollection<T = any>(
    name: string,
    options?: Record<string, any>
  ): Promise<ICollection<T>> {
    await this.raw.createCollection(name, options);
    return this.collection<T>(name);
  }

  async listCollections(): Promise<{name: string}[]> {
    const collections = await this.raw.collections();
    return collections.map(collection => ({name: collection.collectionName}));
  }

  dropCollection(name: string): Promise<boolean> {
    return this.raw.dropCollection(name);
  }

  async ping(): Promise<void> {
    await this.raw.command({ping: 1});
  }

  setProfilingLevel(level: string): Promise<unknown> {
    return this.raw.setProfilingLevel(level as any);
  }

  command(command: Record<string, any>): Promise<any> {
    return this.raw.command(command);
  }

  indexes(collection: string): IIndexManager {
    return new MongoIndexManager(this, collection);
  }
}
