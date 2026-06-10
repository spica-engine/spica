import {MongoClient} from "mongodb";
import {runReset, expandModules, resetHandlers, ResetContext} from "../src/reset";

function makeDb(collectionNames: string[]) {
  const collections: Record<string, any> = {};
  const collection = jest.fn((name: string) => {
    if (!collections[name]) {
      collections[name] = {
        drop: jest.fn().mockResolvedValue(true),
        deleteMany: jest.fn().mockResolvedValue({deletedCount: 0})
      };
    }
    return collections[name];
  });
  const db = {
    collection,
    collections,
    listCollections: jest.fn(() => ({
      toArray: () => Promise.resolve(collectionNames.map(name => ({name})))
    }))
  };
  return db;
}

const ctx: ResetContext = {
  databaseName: "inst",
  defaultIdentifier: "spica"
};

describe("reset", () => {
  let db: ReturnType<typeof makeDb>;
  let closeSpy: jest.SpyInstance;

  function wire(names: string[]) {
    db = makeDb(names);
    jest.spyOn(MongoClient.prototype, "connect").mockResolvedValue(undefined as any);
    jest.spyOn(MongoClient.prototype, "db").mockReturnValue(db as any);
    closeSpy = jest.spyOn(MongoClient.prototype, "close").mockResolvedValue(undefined as any);
  }

  afterEach(() => jest.restoreAllMocks());

  it("connects with the configured database and always closes", async () => {
    wire([]);
    await runReset("mongodb://localhost:1/?directConnection=true", ctx, []);
    expect(MongoClient.prototype.db).toHaveBeenCalledWith("inst");
    expect(closeSpy).toHaveBeenCalled();
  });

  it("bucket-data drops only bucket_* data collections, never the schema collection", async () => {
    wire(["bucket_1", "bucket_2", "buckets", "identity"]);
    await runReset("mongodb://localhost:1/?directConnection=true", ctx, ["bucket-data"]);
    expect(db.collections["bucket_1"].drop).toHaveBeenCalled();
    expect(db.collections["bucket_2"].drop).toHaveBeenCalled();
    expect(db.collections["buckets"]).toBeUndefined();
  });

  it("bucket drops both the data collections and the schema collection", async () => {
    wire(["bucket_1", "buckets"]);
    await runReset("mongodb://localhost:1/?directConnection=true", ctx, ["bucket"]);
    expect(db.collections["bucket_1"].drop).toHaveBeenCalled();
    expect(db.collections["buckets"].drop).toHaveBeenCalled();
  });

  it("identity deletes non-default identities and clears refresh tokens, leaving users alone", async () => {
    wire(["identity", "user", "refresh_token"]);
    await runReset("mongodb://localhost:1/?directConnection=true", ctx, ["identity"]);
    expect(db.collections["identity"].deleteMany).toHaveBeenCalledWith({
      identifier: {$ne: "spica"}
    });
    expect(db.collections["refresh_token"].drop).toHaveBeenCalled();
    // identity and user are now separate modules — resetting identity must not touch user
    expect(db.collections["user"]).toBeUndefined();
  });

  it("user clears the passport/user model collection, preserving the default, and nothing else", async () => {
    // Identities created via POST /passport/user live in a separate `user` collection
    // (username-keyed); reset(['user']) wipes those without touching the legacy identity store.
    wire(["identity", "user"]);
    await runReset("mongodb://localhost:1/?directConnection=true", ctx, ["user"]);
    expect(db.collections["user"].deleteMany).toHaveBeenCalledWith({
      username: {$ne: "spica"}
    });
    expect(db.collections["identity"]).toBeUndefined();
  });

  it("apikey clears every key (the instance authenticates with the default identity, not a key)", async () => {
    wire(["apikey"]);
    await runReset("mongodb://localhost:1/?directConnection=true", ctx, ["apikey"]);
    expect(db.collections["apikey"].deleteMany).toHaveBeenCalledWith({});
  });

  it("function and storage drop their collections", async () => {
    wire(["function", "storage"]);
    await runReset("mongodb://localhost:1/?directConnection=true", ctx, ["function", "storage"]);
    expect(db.collections["function"].drop).toHaveBeenCalled();
    expect(db.collections["storage"].drop).toHaveBeenCalled();
  });

  it("swallows NamespaceNotFound when a collection is absent", async () => {
    wire(["function"]);
    db.collections; // ensure object exists
    jest.spyOn(MongoClient.prototype, "db").mockReturnValue({
      collection: () => ({
        drop: jest.fn().mockRejectedValue({codeName: "NamespaceNotFound"})
      }),
      listCollections: () => ({toArray: () => Promise.resolve([])})
    } as any);
    await expect(runReset("mongodb://localhost:1/?directConnection=true", ctx, ["function"])).resolves.toBeUndefined();
  });

  describe("expandModules", () => {
    it("expands 'all' to every module in a safe order", () => {
      expect(expandModules(["all"])).toEqual([
        "function",
        "bucket",
        "storage",
        "apikey",
        "identity",
        "user"
      ]);
    });

    it("de-dupes explicit modules while preserving order", () => {
      expect(expandModules(["bucket", "bucket", "identity"])).toEqual(["bucket", "identity"]);
    });
  });

  it("exposes a handler per module", () => {
    expect(Object.keys(resetHandlers).sort()).toEqual(
      ["apikey", "bucket", "bucket-data", "function", "identity", "storage", "user"].sort()
    );
  });
});
