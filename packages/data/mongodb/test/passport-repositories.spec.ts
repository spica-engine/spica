import {Test} from "@nestjs/testing";
import {DuplicateKeyError} from "@spica-server/data";
import {
  MongoApiKeyRepository,
  MongoIdentityRepository,
  MongoUserRepository,
  MongoVerificationRepository
} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";

describe("passport repositories", () => {
  let db: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    db = module.get(DatabaseService);
  });

  const identity = (identifier: string, policies: string[] = []) => ({
    identifier,
    password: "hashed",
    policies,
    lastPasswords: [],
    failedAttempts: [],
    lastLogin: undefined
  });

  it("should pull a policy from every identity, user and apikey that has it", async () => {
    const identities = new MongoIdentityRepository(db, {entryLimit: undefined} as any);
    const users = new MongoUserRepository(db, {} as any);
    const apiKeys = new MongoApiKeyRepository(db);
    const updates: [string, object, object][] = [];
    for (const [name, repository] of [
      ["identity", identities],
      ["user", users],
      ["apikey", apiKeys]
    ] as const) {
      const updateMany = repository.updateMany.bind(repository);
      jest.spyOn(repository, "updateMany").mockImplementation((filter, update) => {
        updates.push([name, filter, update]);
        return updateMany(filter, update);
      });
    }
    await db
      .collection("identity")
      .insertMany([identity("a", ["p1", "p2"]), identity("b", ["p2"]), identity("c", ["p3"])]);

    expect(await identities.removePolicyFromAll("p2")).toEqual(2);
    await users.removePolicyFromAll("p2");
    await apiKeys.removePolicyFromAll("p2");

    expect(
      (await db.collection("identity").find().sort({identifier: 1}).toArray()).map(i => i.policies)
    ).toEqual([["p1"], [], ["p3"]]);
    expect(updates).toEqual(
      ["identity", "user", "apikey"].map(name => [
        name,
        {policies: {$in: ["p2"]}},
        {$pull: {policies: "p2"}}
      ])
    );
  });

  it("should report duplicate identifiers as DuplicateKeyError", async () => {
    const identities = new MongoIdentityRepository(db, {} as any);
    await db.collection("identity").createIndex({identifier: 1}, {unique: true});
    await identities.insert(identity("spica"));

    const error = await identities.insert(identity("spica")).catch(e => e);

    expect(error).toBeInstanceOf(DuplicateKeyError);
    expect(error.keyValue).toEqual({identifier: "spica"});
  });

  it("should insert the default identity only when it is missing", async () => {
    const identities = new MongoIdentityRepository(db, {} as any);

    await identities.insertIfMissing(identity("spica"));
    await identities.insertIfMissing({...identity("spica"), password: "other"});

    expect(await db.collection("identity").find().toArray()).toEqual([
      expect.objectContaining({identifier: "spica", password: "hashed"})
    ]);
  });

  it("should set user attributes by path without dropping the others", async () => {
    const users = new MongoUserRepository(db, {} as any);
    const {insertedId} = await db
      .collection("user")
      .insertOne({username: "u", attributes: {a: 1, b: 2}});

    const updated = await users.setAttributes(insertedId, {b: 3, c: 4});

    expect(updated.attributes).toEqual({a: 1, b: 3, c: 4});
  });

  it("should reuse the pending verification of a target and consume it once", async () => {
    const verifications = new MongoVerificationRepository(db, {} as any);
    const userId = new ObjectId();
    const target = {userId, strategy: "Otp", purpose: "verify"};

    const first = await verifications.upsertPending(target, {
      destination: "a@b.c",
      provider: "email",
      code: "c1"
    });
    const second = await verifications.upsertPending(target, {
      destination: "a@b.c",
      provider: "email",
      code: "c2"
    });

    expect(second._id).toEqual(first._id);
    expect(second.requestCount).toEqual(2);
    expect(second.code).toEqual("c2");

    const consumed = await verifications.consume({...target, provider: "email"});
    expect(consumed.is_used).toEqual(false);
    expect(await verifications.consume({...target, provider: "email"})).toBeNull();
  });
});
