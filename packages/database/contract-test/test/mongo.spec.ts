import {afterAll, describe, expect, it} from "@jest/globals";
import {MongoClient} from "mongodb";
import {
  DatabaseService,
  getCollection,
  getIndexManager,
  isId,
  mongoCapabilities,
  ObjectId,
  OBJECT_ID,
  MongoDatabase
} from "@spica-server/database";
import {start} from "@spica-server/database-testing";
import {
  ContractHarness,
  describeCollectionContract,
  describeIndexManagerContract,
  IndexHarness
} from "@spica-server/database-contract-test";

/**
 * Runs the contract test against the MongoDB driver (Phase 1 step 1b).
 *
 * The only driver-specific code here is the harness. In Phase 4 `postgres.spec.ts` runs the same suite
 * for PG; the suite itself will not change.
 *
 * A single server/client is shared across the file and closed **exactly once**; because every `start()`
 * call brings up a new `mongodb-memory-server`, this is both fast and makes a double close impossible.
 */
let clientPromise: Promise<MongoClient> | undefined;

function getClient(): Promise<MongoClient> {
  if (!clientPromise) clientPromise = start("standalone");
  return clientPromise;
}

async function db(name: string): Promise<DatabaseService> {
  const client = await getClient();
  /**
   * A real `MongoDatabase`, not a cast (Phase 6 slice 6a).
   *
   * If the cast is left in, `getCollection` returns the raw Mongo `Collection`: `find()` gives a cursor
   * rather than a promise, and it carries `collectionName` instead of `name`. Catching that is the
   * contract test's expected behaviour — there has to be a driver behind the token.
   */
  return new MongoDatabase(client.db(name));
}

afterAll(async () => {
  if (clientPromise) {
    const client = await clientPromise;
    await client.close().catch(() => {});
  }
});

async function createMongoHarness(): Promise<ContractHarness> {
  const database = await db("contract_test");
  return {
    name: "mongodb",
    capabilities: mongoCapabilities,
    async open(name, options) {
      const coll = getCollection(database, name, options);
      await coll.deleteMany({});
      return coll as any;
    },
    // The shared client is closed in the file-level afterAll.
    async teardown() {}
  };
}

describeCollectionContract(createMongoHarness);

async function createMongoIndexHarness(): Promise<IndexHarness> {
  const database = await db("contract_test");
  return {
    name: "mongodb",
    async open(collection) {
      const coll = getCollection(database, collection);
      return {
        manager: getIndexManager(database, collection),
        // A precondition: on Mongo `listIndexes()` blows up on a collection that does not exist (the same reason as R21).
        seed: async () => {
          await coll.insertOne({seed: true});
        }
      };
    },
    async teardown() {}
  };
}

describeIndexManagerContract(createMongoIndexHarness);

/**
 * The regression guard of slice 2b.
 *
 * The `ObjectId` that `@spica-server/database` exports has to be the **same class** as the value the
 * `OBJECT_ID` pipe produces. If `src/pipes.ts` is left behind while `ObjectId` moves to `bson` in 2b,
 * this test breaks — and if it does not break, the five `instanceof ObjectId` checks in
 * `packages/api/storage` silently take the wrong branch and `GET /storage/:id` falls through to
 * `getByName` on every valid id.
 */
describe("driver invariants", () => {
  it("the value the OBJECT_ID pipe produces is an instance of the exported ObjectId", () => {
    const produced = OBJECT_ID.transform("507f1f77bcf86cd799439011", undefined);
    expect(produced instanceof ObjectId).toBe(true);
  });

  it("the exported ObjectId and the pipe's output share the same class", () => {
    const produced: any = OBJECT_ID.transform("507f1f77bcf86cd799439011", undefined);
    expect(produced.constructor).toBe(ObjectId);
  });

  it("an _id read from the database is recognized as an id by isId()", async () => {
    const coll = getCollection(await db("contract_invariants"), "invariant_check");
    await coll.deleteMany({});
    const inserted = await coll.insertOne({title: "a"});
    const read = await coll.findOne({_id: inserted._id});
    expect(isId(read._id)).toBe(true);
  });

  /**
   * The test that documents the trap itself.
   *
   * The Mongo driver deserializes the values it reads with **its own** copy of bson, while the
   * application layer uses the ESM copy of `bson` (the dual-package hazard, see the note in `index.ts`).
   * That is why `instanceof ObjectId` returns **false** on an `_id` that was read back.
   *
   * The point of this test is not to defend the behaviour but to make the trap visible: if someone
   * reaches for `instanceof ObjectId`, the record of why it does not work is here. The correct check at
   * the contract level is `isId()`.
   */
  it("instanceof does NOT work on an _id that was read back — that is why isId() exists", async () => {
    const coll = getCollection(await db("contract_invariants"), "instanceof_trap");
    await coll.deleteMany({});
    const inserted = await coll.insertOne({title: "a"});
    const read = await coll.findOne({_id: inserted._id});
    expect(read._id instanceof ObjectId).toBe(false);
    expect(isId(read._id)).toBe(true);
    // Comparing ids through hex works across the copies:
    expect(read._id.equals(new ObjectId(read._id.toHexString()))).toBe(true);
  });
});
