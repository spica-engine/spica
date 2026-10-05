import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, getCollection} from "@spica-server/database";
import {DatabaseTestingModule} from "@spica-server/database-testing";

/**
 * `DatabaseTestingModule.postgres()` — the precondition for running the whole suite on the second leg.
 *
 * What is verified: **the spec's code does not know which backend it runs on.** The body below runs
 * identically on the Mongo leg; the only difference is which `DatabaseTestingModule` factory is called.
 * Running the hundreds of existing specs on the second leg rests on exactly that invariant.
 */
describe("DatabaseTestingModule.postgres()", () => {
  let module: TestingModule;
  let database: DatabaseService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()]
    }).compile();
    database = module.get(DatabaseService);
  }, 180_000);

  afterAll(async () => {
    await module?.close();
  }, 60_000);

  it("the DatabaseService token gives the PostgreSQL driver", () => {
    expect(database.capabilities.backend).toBe("postgres");
  });

  it("bootstrap has run — the system tables are ready", async () => {
    const collections = await database.listCollections();
    const names = collections.map(c => c.name);
    expect(names).toContain("identity");
    expect(names).toContain("buckets");
  });

  it("can write to and read from a system collection", async () => {
    const identity = getCollection(database, "identity");
    const inserted = await identity.insertOne({identifier: "alice", password: "x"} as any);
    expect(inserted._id).toBeDefined();

    const found = await identity.findOne({identifier: "alice"});
    expect(found.identifier).toBe("alice");
  });

  it("ping works", async () => {
    await expect(database.ping()).resolves.toBeUndefined();
  });

  /**
   * `collection("buckets")` — the call in production (`bucket/common/src/crud.ts:231`). It has to
   * resolve through the test module too, otherwise the bucket specs blow up on the PG leg.
   */
  it("collection('buckets') resolves", () => {
    expect(() => database.collection("buckets")).not.toThrow();
  });

  it("every module gets its own database — isolation", async () => {
    const second = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()]
    }).compile();
    const other = second.get(DatabaseService);

    try {
      await getCollection(database, "identity").insertOne({identifier: "only-here"} as any);
      const leaked = await getCollection(other, "identity").findOne({identifier: "only-here"});
      expect(leaked).toBeFalsy();
    } finally {
      await second.close();
    }
  }, 120_000);
});
