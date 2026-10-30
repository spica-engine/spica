import {Test} from "@nestjs/testing";
import {
  MongoActivityRepository,
  MongoCommandRepository,
  MongoFunctionLogRepository,
  MongoJobRepository,
  MongoRefreshTokenRepository,
  MongoStatusRepository,
  MongoVerificationRepository,
  MongoWebhookLogRepository
} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database-testing";
import {ExpiringRepository} from "@spica-server/interface-data";

describe("expiry", () => {
  let db: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    db = module.get(DatabaseService);
  });

  async function expirationOf(collection: string, field: string) {
    const indexes = await db.collection(collection).listIndexes().toArray();
    return indexes.find(index => index.key[field] == 1)?.expireAfterSeconds;
  }

  const createdAtRepositories: [
    string,
    string,
    (db: DatabaseService, expireAfterSeconds: number) => ExpiringRepository
  ][] = [
    ["activity", "activity", (db, s) => new MongoActivityRepository(db, {expireAfterSeconds: s})],
    ["status", "status", (db, s) => new MongoStatusRepository(db, {expireAfterSeconds: s} as any)],
    [
      "function logs",
      "function_logs",
      (db, s) => new MongoFunctionLogRepository(db, {expireAfterSeconds: s} as any)
    ],
    [
      "webhook logs",
      "webhook_logs",
      (db, s) => new MongoWebhookLogRepository(db, {expireAfterSeconds: s})
    ],
    [
      "verifications",
      "verification",
      (db, s) => new MongoVerificationRepository(db, {verificationCodeExpiresIn: s} as any)
    ],
    [
      "replication commands",
      "commands",
      (db, s) => new MongoCommandRepository(db, {expireAfterSeconds: s})
    ],
    ["replication jobs", "jobs", (db, s) => new MongoJobRepository(db, {expireAfterSeconds: s})]
  ];

  it.each(createdAtRepositories)(
    "should expire %s by created_at and follow a changed retention",
    async (_name, collection, create) => {
      await create(db, 60).applyExpiry();
      expect(await expirationOf(collection, "created_at")).toBe(60);

      await create(db, 120).applyExpiry();
      expect(await expirationOf(collection, "created_at")).toBe(120);
    }
  );

  it("should expire refresh tokens at their own expired_at", async () => {
    await new MongoRefreshTokenRepository(db).applyExpiry();

    expect(await expirationOf("refresh_token", "expired_at")).toBe(0);
  });

  it("should not create the indexes before the expiry is applied", async () => {
    new MongoActivityRepository(db, {expireAfterSeconds: 60});

    const collections = await db.listCollections({name: "activity"}).toArray();
    expect(collections).toEqual([]);
  });
});
