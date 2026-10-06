import {OnModuleDestroy} from "@nestjs/common";
import {Db, MongoClient} from "mongodb";
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
 * The MongoDB implementation of `DatabaseService`.
 *
 * **It removes the cast this token used to need.** `database.module.ts` was doing
 * `client.db(name) as DatabaseService`; that is, there was no subclass instance behind the token at all,
 * mongodb's `Db` had been forced into a neutral type. Now there is a real instance and every member of the
 * neutral surface is satisfied explicitly here.
 *
 * `raw` exposes mongodb's `Db` **inside this package only**: Mongo-specific work such as
 * `MongoCollection`'s profile collection needs it. `packages/api` does not see this field, because the
 * type injected from there is `DatabaseService`.
 */
export class MongoDatabase
  extends DatabaseService
  implements ISupportsIndexManager, OnModuleDestroy
{
  readonly capabilities: DriverCapabilities = mongoCapabilities;

  /**
   * `client` is given only by whoever **opened** it, which is the module's own factory. The test harness
   * shares one client per process and constructs this class without it on purpose: closing it there would
   * take the server away from the specs that are still running.
   */
  constructor(
    readonly raw: Db,
    private readonly client?: MongoClient
  ) {
    super();
  }

  /**
   * Releases the connection pool. The PostgreSQL side has the same pair, so a caller can shut either
   * backend down without knowing which one it has.
   */
  async close(): Promise<void> {
    await this.client?.close();
  }

  /** Nest calls this on shutdown; a client this class does not own is left alone. */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  get databaseName(): string {
    return this.raw.databaseName;
  }

  collection<T = any>(name: string, options: CollectionOptions = {}): ICollection<T> {
    return new MongoCollection<T>(this, name, options as any).beginInitialization();
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
