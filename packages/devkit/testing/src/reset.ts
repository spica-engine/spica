import {Db, MongoClient, ObjectId} from "mongodb";
import {ResetModule} from "./interface";

export interface ResetContext {
  databaseName: string;
  /** The bootstrap identity to preserve when resetting identities. */
  defaultIdentifier: string;
  /** The instance's own api key to preserve when resetting api keys. */
  apikeyId: string;
}

async function dropIfExists(db: Db, collection: string): Promise<void> {
  try {
    await db.collection(collection).drop();
  } catch (e: any) {
    // "ns not found" - collection does not exist yet, nothing to drop.
    if (e && e.codeName === "NamespaceNotFound") {
      return;
    }
    throw e;
  }
}

async function bucketDataCollections(db: Db): Promise<string[]> {
  const collections = await db.listCollections({}, {nameOnly: true}).toArray();
  return collections.map(c => c.name).filter(name => /^bucket_/.test(name));
}

/**
 * Per-module reset handlers. Each drops/clears the collections that own a module's state.
 * Exposed individually so tests can assert exact collection targeting.
 *
 * NOTE: this is a mongo-direct reset and bypasses the api's cascade logic. In particular
 * `function` reset drops the collection but does not unregister already-loaded
 * functions/triggers from the running api process, and `storage` reset leaves the
 * uploaded files on the api volume. Prefer data-module resets between tests.
 */
export const resetHandlers: Record<
  Exclude<ResetModule, "all">,
  (db: Db, ctx: ResetContext) => Promise<void>
> = {
  "bucket-data": async db => {
    for (const name of await bucketDataCollections(db)) {
      await dropIfExists(db, name);
    }
  },
  bucket: async (db, ctx) => {
    await resetHandlers["bucket-data"](db, ctx);
    await dropIfExists(db, "buckets");
  },
  identity: async (db, ctx) => {
    await db.collection("identity").deleteMany({identifier: {$ne: ctx.defaultIdentifier}});
    // The passport/user model stores its identities in a separate `user` collection
    // (username-keyed) rather than `identity`. Clear those too, preserving any row that
    // matches the bootstrap identifier. deleteMany on a missing collection is a no-op, so
    // this is safe on older api versions that have no `user` collection.
    await db.collection("user").deleteMany({username: {$ne: ctx.defaultIdentifier}});
    await dropIfExists(db, "refresh_token");
  },
  apikey: async (db, ctx) => {
    await db.collection("apikey").deleteMany({_id: {$ne: new ObjectId(ctx.apikeyId)}});
  },
  function: async db => {
    await dropIfExists(db, "function");
  },
  storage: async db => {
    await dropIfExists(db, "storage");
  }
};

/** Order used by the "all" alias - data first, credentials last (default kept). */
const ALL_ORDER: Array<Exclude<ResetModule, "all">> = [
  "function",
  "bucket",
  "storage",
  "apikey",
  "identity"
];

export function expandModules(modules: ResetModule[]): Array<Exclude<ResetModule, "all">> {
  if (modules.includes("all")) {
    return [...ALL_ORDER];
  }
  // de-dupe while preserving caller order
  return [...new Set(modules)] as Array<Exclude<ResetModule, "all">>;
}

/**
 * Connect to mongo (directConnection so the single-node replica set is reachable from the
 * host), run the requested module handlers, then close the connection.
 */
export async function runReset(
  mongoUrl: string,
  ctx: ResetContext,
  modules: ResetModule[]
): Promise<void> {
  const client = new MongoClient(mongoUrl, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });
  try {
    await client.connect();
    const db = client.db(ctx.databaseName);
    for (const mod of expandModules(modules)) {
      await resetHandlers[mod](db, ctx);
    }
  } finally {
    await client.close();
  }
}
