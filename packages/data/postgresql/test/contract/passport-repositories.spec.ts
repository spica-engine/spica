import {Test, TestingModule} from "@nestjs/testing";
import pg from "pg";
import {DuplicateKeyError, provideRepository} from "@spica-server/data";
import {contractSuite, DatabaseService} from "@spica-server/database-testing";
import {ID_TYPES, IdType, IdTypes, PG_POOL} from "@spica-server/interface-data";
import {STRATEGY_REPOSITORY, StrategyRepository} from "@spica-server/interface-passport";
import {APIKEY_REPOSITORY, ApiKeyRepository} from "@spica-server/interface-passport-apikey";
import {
  IDENTITY_OPTIONS,
  IDENTITY_REPOSITORY,
  IdentityRepository
} from "@spica-server/interface-passport-identity";
import {POLICY_REPOSITORY, PolicyRepository} from "@spica-server/interface-passport-policy";
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository
} from "@spica-server/interface-passport-refresh_token";
import {
  USER_OPTIONS,
  USER_REPOSITORY,
  UserRepository,
  VERIFICATION_REPOSITORY,
  VerificationRepository
} from "@spica-server/interface-passport-user";

const UNIQUE_INDEXES = {
  identity: ["identifier_1"],
  user: ["username_1", "email.hash_1", "phone.hash_1"]
};

const MONGO_COLLECTIONS = [
  "identity",
  "user",
  "verification",
  "apikey",
  "policies",
  "refresh_token",
  "strategy"
];

const POSTGRES_TABLES = [
  "identities",
  "users",
  "verifications",
  "apikeys",
  "policies",
  "refresh_tokens",
  "strategies"
];

contractSuite("passport repositories", engine => {
  async function waitForMongoIndexes() {
    if (engine.name != "mongodb") {
      return;
    }
    const db = module.get(DatabaseService);
    for (const [collection, names] of Object.entries(UNIQUE_INDEXES)) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const existing = await db
          .collection(collection)
          .indexes()
          .catch(() => []);
        if (names.every(name => existing.some(index => index.name == name))) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  let module: TestingModule;
  let idType: IdType;
  let identities: IdentityRepository;
  let users: UserRepository;
  let verifications: VerificationRepository;
  let apiKeys: ApiKeyRepository;
  let policies: PolicyRepository;
  let refreshTokens: RefreshTokenRepository;
  let strategies: StrategyRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [
        {provide: IDENTITY_OPTIONS, useValue: {entryLimit: 5}},
        {provide: USER_OPTIONS, useValue: {entryLimit: 5}},
        provideRepository(IDENTITY_REPOSITORY),
        provideRepository(USER_REPOSITORY),
        provideRepository(VERIFICATION_REPOSITORY),
        provideRepository(APIKEY_REPOSITORY),
        provideRepository(POLICY_REPOSITORY),
        provideRepository(REFRESH_TOKEN_REPOSITORY),
        provideRepository(STRATEGY_REPOSITORY)
      ]
    }).compile();
    await module.init();
    await waitForMongoIndexes();

    idType = module.get<IdTypes>(ID_TYPES).unscoped();
    identities = module.get(IDENTITY_REPOSITORY);
    users = module.get(USER_REPOSITORY);
    verifications = module.get(VERIFICATION_REPOSITORY);
    apiKeys = module.get(APIKEY_REPOSITORY);
    policies = module.get(POLICY_REPOSITORY);
    refreshTokens = module.get(REFRESH_TOKEN_REPOSITORY);
    strategies = module.get(STRATEGY_REPOSITORY);
  }, 120_000);

  beforeEach(async () => {
    if (engine.name == "mongodb") {
      const db = module.get(DatabaseService);
      for (const name of MONGO_COLLECTIONS) {
        await db.collection(name).deleteMany({});
      }
    } else {
      await module.get<pg.Pool>(PG_POOL).query(`TRUNCATE ${POSTGRES_TABLES.join(", ")}`);
    }
  });

  afterAll(() => module.close());

  const identity = (identifier: string, policy: string[] = []) => ({
    identifier,
    password: "hashed",
    policies: policy,
    lastPasswords: ["old"],
    failedAttempts: [],
    lastLogin: undefined
  });

  const user = (username: string, extra: object = {}) => ({
    username,
    password: "hashed",
    policies: [],
    lastPasswords: ["old"],
    failedAttempts: [],
    lastLogin: undefined,
    ...extra
  });

  const missingId = () => idType.generate();

  describe("identity", () => {
    it("inserts and finds an identity by id and identifier", async () => {
      const inserted = await identities.insert(identity("spica"));

      expect(inserted._id).toBeDefined();
      expect(await identities.findById(inserted._id)).toMatchObject({
        identifier: "spica",
        password: "hashed",
        policies: [],
        lastPasswords: ["old"]
      });
      expect(String((await identities.findByIdentifier("spica"))._id)).toBe(String(inserted._id));
      expect(await identities.findByIdentifier("nobody")).toBeNull();
      expect(await identities.findById(missingId())).toBeNull();
    });

    it("hides the requested fields of findById", async () => {
      const {_id} = await identities.insert(identity("spica"));

      const found = await identities.findById(_id, {password: 0, lastPasswords: 0});

      expect(found.identifier).toBe("spica");
      expect(found).not.toHaveProperty("password");
      expect(found).not.toHaveProperty("lastPasswords");
    });

    it("hides dotted fields of findById", async () => {
      const {_id} = await identities.insert(identity("spica"));
      await identities.setAuthFactor(_id, {
        type: "totp",
        config: {},
        secret: "s3cret"
      } as any);

      const found = await identities.findById(_id, {"authFactor.secret": 0});

      expect(found.authFactor).toMatchObject({type: "totp"});
      expect(found.authFactor).not.toHaveProperty("secret");
    });

    it("reports duplicate identifiers as DuplicateKeyError", async () => {
      await identities.insert(identity("spica"));

      const error = await identities.insert(identity("spica")).catch(e => e);

      expect(error).toBeInstanceOf(DuplicateKeyError);
      expect(error.keyValue).toEqual({identifier: "spica"});
    });

    it("inserts the default identity only when it is missing", async () => {
      await identities.insertIfMissing(identity("spica"));
      await identities.insertIfMissing({...identity("spica"), password: "other"});

      expect((await identities.findByIdentifier("spica")).password).toBe("hashed");
    });

    it("updates an identity and resolves to the updated one", async () => {
      const {_id} = await identities.insert(identity("spica"));

      const updated = await identities.updateById(_id, {deactivateJwtsBefore: 1700000000123});

      expect(updated).toMatchObject({identifier: "spica", deactivateJwtsBefore: 1700000000123});
      expect(await identities.updateById(missingId(), {password: "x"})).toBeNull();
    });

    it("reports duplicate identifiers raised by updates", async () => {
      await identities.insert(identity("a"));
      const {_id} = await identities.insert(identity("b"));

      const error = await identities.updateById(_id, {identifier: "a"}).catch(e => e);

      expect(error).toBeInstanceOf(DuplicateKeyError);
    });

    it("stores the login state", async () => {
      const {_id} = await identities.insert(identity("spica"));
      const failedAttempts = [new Date("2024-01-01T00:00:00Z"), new Date("2024-01-02T00:00:00Z")];
      const lastLogin = new Date("2024-02-01T00:00:00Z");

      await identities.updateLoginState("spica", {failedAttempts, lastLogin});

      expect(await identities.findById(_id)).toMatchObject({failedAttempts, lastLogin});
    });

    it("sets an auth factor and resolves to the identity as it was when removing it", async () => {
      const {_id} = await identities.insert(identity("spica"));
      const authFactor = {type: "totp", config: {issuer: "spica"}, secret: "s3cret"} as any;

      await identities.setAuthFactor(_id, authFactor);
      expect((await identities.findWithAuthFactor()).map(i => i.identifier)).toEqual(["spica"]);

      const before = await identities.removeAuthFactor(_id);

      expect(before.authFactor).toEqual(authFactor);
      expect((await identities.findById(_id)).authFactor).toBeUndefined();
      expect(await identities.findWithAuthFactor()).toEqual([]);
      expect(await identities.removeAuthFactor(missingId())).toBeNull();
    });

    it("adds and removes policies without duplicating them or exposing passwords", async () => {
      const {_id} = await identities.insert(identity("spica", ["p1"]));

      const added = await identities.addPolicy(_id, "p2");
      const addedAgain = await identities.addPolicy(_id, "p2");
      const removed = await identities.removePolicy(_id, "p1");

      expect(added.policies).toEqual(["p1", "p2"]);
      expect(addedAgain.policies).toEqual(["p1", "p2"]);
      expect(removed.policies).toEqual(["p2"]);
      for (const result of [added, addedAgain, removed]) {
        expect(result).not.toHaveProperty("password");
        expect(result).not.toHaveProperty("lastPasswords");
      }
      expect(await identities.addPolicy(missingId(), "p")).toBeNull();
      expect(await identities.removePolicy(missingId(), "p")).toBeNull();
    });

    it("pulls a policy from every identity that has it", async () => {
      await identities.insert(identity("a", ["p1", "p2"]));
      await identities.insert(identity("b", ["p2"]));
      await identities.insert(identity("c", ["p3"]));

      expect(await identities.removePolicyFromAll("p2")).toBe(2);

      const policiesOf = async (identifier: string) =>
        (await identities.findByIdentifier(identifier)).policies;
      expect([await policiesOf("a"), await policiesOf("b"), await policiesOf("c")]).toEqual([
        ["p1"],
        [],
        ["p3"]
      ]);
    });

    it("deletes an identity and counts the deletion", async () => {
      const {_id} = await identities.insert(identity("spica"));

      expect(await identities.deleteById(_id)).toBe(1);
      expect(await identities.deleteById(_id)).toBe(0);
      expect(await identities.findById(_id)).toBeNull();
    });

    it("reports its status and refuses inserts beyond the entry limit", async () => {
      for (const name of ["a", "b", "c", "d", "e"]) {
        await identities.insert(identity(name));
      }

      expect(await identities.status()).toEqual({limit: 5, current: 5, unit: "count"});
      expect(await identities.estimatedCount()).toBe(5);
      await expect(identities.insert(identity("f"))).rejects.toThrow(
        "Maximum number of documents has been reached"
      );
    });
  });

  describe("user", () => {
    const email = (hash: string) => ({encrypted: "e", iv: "i", authTag: "a", hash});

    it("inserts and finds a user by id and username", async () => {
      const inserted = await users.insert(user("alice", {attributes: {color: "red"}}));

      expect(await users.findById(inserted._id)).toMatchObject({
        username: "alice",
        attributes: {color: "red"}
      });
      expect(String((await users.findByUsername("alice"))._id)).toBe(String(inserted._id));
      expect(await users.findByUsername("nobody")).toBeNull();
    });

    it("reports duplicate usernames, emails and phones as DuplicateKeyError", async () => {
      await users.insert(user("alice", {email: email("h1"), phone: email("p1")}));

      const username = await users.insert(user("alice")).catch(e => e);
      const mail = await users.insert(user("bob", {email: email("h1")})).catch(e => e);
      const phone = await users.insert(user("carol", {phone: email("p1")})).catch(e => e);

      expect(username).toBeInstanceOf(DuplicateKeyError);
      expect(username.keyValue).toEqual({username: "alice"});
      expect(mail).toBeInstanceOf(DuplicateKeyError);
      expect(mail.keyValue).toEqual({"email.hash": "h1"});
      expect(phone).toBeInstanceOf(DuplicateKeyError);
      expect(phone.keyValue).toEqual({"phone.hash": "p1"});
    });

    it("allows any number of users without an email", async () => {
      await users.insert(user("alice"));
      await expect(users.insert(user("bob"))).resolves.toBeDefined();
    });

    it("inserts the default user only when it is missing", async () => {
      await users.insertIfMissing(user("alice"));
      await users.insertIfMissing(user("alice", {password: "other"}));

      expect((await users.findByUsername("alice")).password).toBe("hashed");
    });

    it("updates a user and resolves to the updated one", async () => {
      const {_id} = await users.insert(user("alice"));

      expect(
        await users.updateById(_id, {bannedUntil: new Date("2030-01-01T00:00:00Z")})
      ).toMatchObject({
        username: "alice",
        bannedUntil: new Date("2030-01-01T00:00:00Z")
      });
      expect(await users.updateById(missingId(), {password: "x"})).toBeNull();
    });

    it("sets fields, including dotted paths, without reading the user", async () => {
      const {_id} = await users.insert(user("alice", {attributes: {color: "red"}}));
      const verifiedAt = new Date("2024-03-01T00:00:00Z");

      await users.setFields(_id, {
        email: email("h1"),
        email_verified_at: verifiedAt,
        "attributes.size": 3
      });

      expect(await users.findById(_id)).toMatchObject({
        email: email("h1"),
        email_verified_at: verifiedAt,
        attributes: {color: "red", size: 3}
      });
    });

    it("merges attributes and resolves to the updated user", async () => {
      const {_id} = await users.insert(user("alice", {attributes: {color: "red", size: 1}}));

      const updated = await users.setAttributes(_id, {size: 2, shape: "round"});

      expect(updated.attributes).toEqual({color: "red", size: 2, shape: "round"});
      expect(await users.setAttributes(missingId(), {a: 1})).toBeNull();
    });

    it("stores the login state and auth factor", async () => {
      const {_id} = await users.insert(user("alice"));
      const failedAttempts = [new Date("2024-01-01T00:00:00Z")];
      const lastLogin = new Date("2024-02-01T00:00:00Z");
      const authFactor = {type: "totp", config: {}, secret: "s"} as any;

      await users.updateLoginState("alice", {failedAttempts, lastLogin});
      await users.setAuthFactor(_id, authFactor);

      expect(await users.findById(_id)).toMatchObject({failedAttempts, lastLogin, authFactor});
      expect((await users.findWithAuthFactor()).map(u => u.username)).toEqual(["alice"]);
      expect((await users.removeAuthFactor(_id)).authFactor).toEqual(authFactor);
      expect((await users.findById(_id)).authFactor).toBeUndefined();
    });

    it("adds and removes policies without exposing passwords", async () => {
      const {_id} = await users.insert(user("alice"));

      const added = await users.addPolicy(_id, "p1");
      await users.addPolicy(_id, "p2");
      const removed = await users.removePolicy(_id, "p1");

      expect(added.policies).toEqual(["p1"]);
      expect(added).not.toHaveProperty("password");
      expect(removed.policies).toEqual(["p2"]);
      expect(await users.removePolicyFromAll("p2")).toBe(1);
      expect((await users.findById(_id)).policies).toEqual([]);
    });

    it("deletes a user and reports its status", async () => {
      const {_id} = await users.insert(user("alice"));

      expect(await users.status()).toEqual({limit: 5, current: 1, unit: "count"});
      expect(await users.deleteById(_id)).toBe(1);
      expect(await users.deleteById(_id)).toBe(0);
    });
  });

  describe("verification", () => {
    const target = () => ({userId: idType.generate(), strategy: "otp", purpose: "login"});
    const pending = {destination: "a@b.c", provider: "email", code: "111"};

    it("creates a pending verification and counts repeated requests", async () => {
      const t = target();

      const first = await verifications.upsertPending(t, pending);
      const second = await verifications.upsertPending(t, {...pending, code: "222"});

      expect(String(second._id)).toBe(String(first._id));
      expect(first.requestCount).toBe(1);
      expect(second).toMatchObject({
        code: "222",
        requestCount: 2,
        destination: "a@b.c",
        strategy: "otp",
        purpose: "login",
        is_used: false
      });
    });

    it("keeps verifications of different targets apart", async () => {
      const a = await verifications.upsertPending(target(), pending);
      const b = await verifications.upsertPending(target(), pending);

      expect(String(a._id)).not.toBe(String(b._id));
    });

    it("consumes an unused verification once and resolves to it as it was", async () => {
      const t = target();
      await verifications.upsertPending(t, pending);

      const consumed = await verifications.consume({...t, provider: "email"});

      expect(consumed).toMatchObject({code: "111", is_used: false});
      expect(await verifications.consume({...t, provider: "email"})).toBeNull();
    });

    it("does not consume a verification of another provider", async () => {
      const t = target();
      await verifications.upsertPending(t, pending);

      expect(await verifications.consume({...t, provider: "phone"})).toBeNull();
    });

    it("starts a new verification once the previous one is consumed", async () => {
      const t = target();
      const first = await verifications.upsertPending(t, pending);
      await verifications.consume({...t, provider: "email"});

      const next = await verifications.upsertPending(t, {...pending, code: "333"});

      expect(String(next._id)).not.toBe(String(first._id));
      expect(next.requestCount).toBe(1);
    });

    it("deletes a verification", async () => {
      const t = target();
      const {_id} = await verifications.upsertPending(t, pending);

      await verifications.deleteById(_id);

      expect(await verifications.consume({...t, provider: "email"})).toBeNull();
    });
  });

  describe("apikey", () => {
    const apiKey = (key: string, extra: object = {}) => ({
      key,
      name: key,
      policies: [],
      active: true,
      ...extra
    });

    it("finds only active keys by their value", async () => {
      const active = await apiKeys.insert(apiKey("k1"));
      await apiKeys.insert(apiKey("k2", {active: false}));

      expect(String((await apiKeys.findActiveByKey("k1"))._id)).toBe(String(active._id));
      expect(await apiKeys.findActiveByKey("k2")).toBeNull();
      expect(await apiKeys.findActiveByKey("nope")).toBeNull();
      expect(await apiKeys.findById(active._id)).toMatchObject({key: "k1", active: true});
    });

    it("updates and replaces an api key", async () => {
      const {_id} = await apiKeys.insert(apiKey("k1", {description: "first"}));

      expect(await apiKeys.updateById(_id, {name: "renamed"})).toMatchObject({
        name: "renamed",
        description: "first"
      });
      const replaced = await apiKeys.replaceById(_id, apiKey("k1", {name: "replaced"}));
      expect(replaced).toMatchObject({name: "replaced"});
      expect(replaced).not.toHaveProperty("description");
      expect(await apiKeys.updateById(missingId(), {name: "x"})).toBeNull();
      expect(await apiKeys.replaceById(missingId(), apiKey("k9"))).toBeNull();
    });

    it("adds and removes policies and pulls one from every key", async () => {
      const a = await apiKeys.insert(apiKey("k1", {policies: ["p1"]}));
      const b = await apiKeys.insert(apiKey("k2", {policies: ["p1", "p2"]}));

      expect((await apiKeys.addPolicy(a._id, "p2")).policies).toEqual(["p1", "p2"]);
      expect((await apiKeys.addPolicy(a._id, "p2")).policies).toEqual(["p1", "p2"]);
      expect((await apiKeys.removePolicy(a._id, "p1")).policies).toEqual(["p2"]);
      expect(await apiKeys.removePolicyFromAll("p2")).toBe(2);
      expect((await apiKeys.findById(a._id)).policies).toEqual([]);
      expect((await apiKeys.findById(b._id)).policies).toEqual(["p1"]);
    });

    it("deletes an api key", async () => {
      const {_id} = await apiKeys.insert(apiKey("k1"));

      expect(await apiKeys.deleteById(_id)).toBe(1);
      expect(await apiKeys.deleteById(_id)).toBe(0);
    });
  });

  describe("policy", () => {
    const policy = (name: string) => ({
      name,
      description: `${name} policy`,
      statement: [
        {action: "bucket:index", module: "bucket", resource: {include: ["*"], exclude: []}}
      ]
    });

    it("inserts, finds and lists policies in creation order", async () => {
      const first = await policies.insert({_id: idType.generate(), ...policy("a")} as any);
      await policies.insert({_id: idType.generate(), ...policy("b")} as any);

      expect(await policies.findById(first._id as any)).toMatchObject(policy("a"));
      expect((await policies.findAll()).map(p => p.name)).toEqual(["a", "b"]);
      expect(await policies.findById(missingId())).toBeNull();
    });

    it("replaces a policy and counts the replacement", async () => {
      const {_id} = await policies.insert({_id: idType.generate(), ...policy("a")} as any);

      expect(await policies.replaceById(_id as any, policy("renamed") as any)).toBe(1);
      expect(await policies.findById(_id as any)).toMatchObject({name: "renamed"});
      expect(await policies.replaceById(missingId(), policy("x") as any)).toBe(0);
    });

    it("deletes a policy", async () => {
      const {_id} = await policies.insert({_id: idType.generate(), ...policy("a")} as any);

      expect(await policies.deleteById(_id as any)).toBe(1);
      expect(await policies.deleteById(_id as any)).toBe(0);
    });
  });

  describe("refresh token", () => {
    const token = (value: string) => ({
      identity: String(idType.generate()),
      token: value,
      created_at: new Date("2024-01-01T00:00:00Z"),
      expired_at: new Date("2024-02-01T00:00:00Z"),
      last_used_at: undefined
    });

    it("inserts a token and finds it by its value", async () => {
      const inserted = await refreshTokens.insert(token("t1"));

      expect(await refreshTokens.findByToken("t1")).toMatchObject({
        token: "t1",
        identity: inserted.identity,
        expired_at: new Date("2024-02-01T00:00:00Z")
      });
      expect(await refreshTokens.findByToken("nope")).toBeNull();
    });

    it("marks a token as used", async () => {
      await refreshTokens.insert(token("t1"));
      const at = new Date("2024-01-15T00:00:00Z");

      expect(await refreshTokens.markUsed("t1", at)).toBe(1);
      expect(await refreshTokens.markUsed("nope", at)).toBe(0);
      expect((await refreshTokens.findByToken("t1")).last_used_at).toEqual(at);
    });

    it("disables a token and resolves to it without the token value", async () => {
      const {_id} = await refreshTokens.insert(token("t1"));

      const disabled = await refreshTokens.setDisabled(_id, true);

      expect(disabled.disabled).toBe(true);
      expect(disabled).not.toHaveProperty("token");
      expect((await refreshTokens.findByToken("t1")).disabled).toBe(true);
      expect(await refreshTokens.setDisabled(missingId(), true)).toBeNull();
    });

    it("deletes a token", async () => {
      const {_id} = await refreshTokens.insert(token("t1"));

      expect(await refreshTokens.deleteById(_id)).toBe(1);
      expect(await refreshTokens.findByToken("t1")).toBeNull();
    });
  });

  describe("strategy", () => {
    const strategy = () => ({
      type: "oauth",
      name: "custom",
      title: "Custom",
      icon: "login",
      options: {
        idp: "custom",
        code: {base_url: "https://idp/code", params: {client_id: "c"}},
        access_token: {base_url: "https://idp/token", params: {client_id: "c"}}
      }
    });

    it("inserts, finds, replaces and deletes a strategy", async () => {
      const {_id} = await strategies.insert(strategy());

      expect(await strategies.findById(_id)).toMatchObject(strategy());
      const replaced = await strategies.replaceById(_id, {...strategy(), title: "Renamed"});
      expect(replaced).toMatchObject({title: "Renamed"});
      expect(await strategies.deleteById(_id)).toBe(1);
      expect(await strategies.deleteById(_id)).toBe(0);
    });

    it("sets the redirect uri of both oauth requests", async () => {
      const {_id} = await strategies.insert(strategy());

      const updated = await strategies.setOAuthRedirectUri(_id, "https://spica/callback");

      expect(updated.options.code.params).toEqual({
        client_id: "c",
        redirect_uri: "https://spica/callback"
      });
      expect(updated.options.access_token.params).toEqual({
        client_id: "c",
        redirect_uri: "https://spica/callback"
      });
    });
  });
});
