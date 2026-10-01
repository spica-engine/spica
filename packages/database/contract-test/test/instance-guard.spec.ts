import {describe, expect, it} from "@jest/globals";
import {
  guardInstance,
  InstanceGuardError,
  INSTANCE_COLLECTION,
  DatabaseService
} from "@spica-server/database";

/**
 * The guard against a silent backend switch (K-8, Phase 6 item 4).
 *
 * It runs with a fake `DatabaseService`: what is protected is the decision logic, not driver behaviour.
 * It needs no container.
 */
interface FakeState {
  record?: Record<string, any>;
  collections: string[];
  backend: string;
}

function fakeDatabase(state: FakeState): DatabaseService {
  const inserted: Record<string, any>[] = [];
  const db = {
    capabilities: {backend: state.backend} as any,
    databaseName: "test",
    collection: (name: string) => {
      expect(name).toBe(INSTANCE_COLLECTION);
      return {
        findOne: async () => state.record,
        insertOne: async (doc: Record<string, any>) => {
          inserted.push(doc);
          return doc;
        }
      } as any;
    },
    listCollections: async () => state.collections.map(name => ({name}))
  } as unknown as DatabaseService;

  (db as any).inserted = inserted;
  return db;
}

const insertedOf = (db: DatabaseService) => (db as any).inserted as Record<string, any>[];

describe("guardInstance", () => {
  it("does nothing when --instance-id is not given (backwards compatibility)", async () => {
    const db = fakeDatabase({collections: [], backend: "mongodb"});
    await guardInstance(db, {});
    expect(insertedOf(db)).toHaveLength(0);
  });

  it("passes when the record matches", async () => {
    const db = fakeDatabase({
      record: {instanceId: "hq-1", backend: "mongodb"},
      collections: ["buckets"],
      backend: "mongodb"
    });
    await guardInstance(db, {instanceId: "hq-1"});
    expect(insertedOf(db)).toHaveLength(0);
  });

  it("a different instanceId → refuses to start", async () => {
    const db = fakeDatabase({
      record: {instanceId: "hq-1", backend: "mongodb"},
      collections: ["buckets"],
      backend: "mongodb"
    });
    await expect(guardInstance(db, {instanceId: "hq-2"})).rejects.toThrow(InstanceGuardError);
    await expect(guardInstance(db, {instanceId: "hq-2"})).rejects.toThrow(/belongs to instance/);
  });

  /** The scenario it is really meant to protect against: the URI scheme changed and the data is about to be split in two. */
  it("the same instance on a different backend → refuses to start", async () => {
    const db = fakeDatabase({
      record: {instanceId: "hq-1", backend: "mongodb"},
      collections: ["buckets"],
      backend: "postgres"
    });
    await expect(guardInstance(db, {instanceId: "hq-1"})).rejects.toThrow(
      /initialized on 'mongodb'/
    );
    await expect(guardInstance(db, {instanceId: "hq-1"})).rejects.toThrow(/migration/);
  });

  it("a populated database with no record → writes the record and continues (the first startup of an existing installation)", async () => {
    const db = fakeDatabase({collections: ["buckets", "identity"], backend: "postgres"});
    await guardInstance(db, {instanceId: "hq-1"});
    expect(insertedOf(db)).toHaveLength(1);
    expect(insertedOf(db)[0]).toMatchObject({instanceId: "hq-1", backend: "postgres"});
  });

  it("an empty database without --database-initialize → refuses to start", async () => {
    const db = fakeDatabase({collections: [], backend: "postgres"});
    await expect(guardInstance(db, {instanceId: "hq-1"})).rejects.toThrow(/empty/);
    await expect(guardInstance(db, {instanceId: "hq-1"})).rejects.toThrow(/--database-initialize/);
  });

  it("an empty database with --database-initialize → writes the record (a new installation)", async () => {
    const db = fakeDatabase({collections: [], backend: "postgres"});
    await guardInstance(db, {instanceId: "hq-1", initialize: true});
    expect(insertedOf(db)).toHaveLength(1);
  });

  /**
   * The `instance` collection existing on its own must not count as "populated": this very guard writes
   * it, so its presence is no proof of an earlier installation.
   */
  it("the database counts as empty when only the instance collection exists", async () => {
    const db = fakeDatabase({collections: [INSTANCE_COLLECTION], backend: "postgres"});
    await expect(guardInstance(db, {instanceId: "hq-1"})).rejects.toThrow(/empty/);
  });
});
