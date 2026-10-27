import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {contractSuite, DatabaseService} from "@spica-server/database-testing";
import {CONFIG_REPOSITORY, ConfigRepository} from "@spica-server/interface-config";
import {ID_TYPES, IdTypes, PG_POOL} from "@spica-server/interface-data";
import {PREFERENCE_REPOSITORY, PreferenceRepository} from "@spica-server/interface-preference";
import pg from "pg";

contractSuite("preference and config repositories", engine => {
  let module: TestingModule;
  let preferences: PreferenceRepository;
  let configs: ConfigRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [provideRepository(PREFERENCE_REPOSITORY), provideRepository(CONFIG_REPOSITORY)]
    }).compile();
    await module.init();
    preferences = module.get(PREFERENCE_REPOSITORY);
    configs = module.get(CONFIG_REPOSITORY);
  }, 120_000);

  beforeEach(async () => {
    if (engine.name == "mongodb") {
      const db = module.get(DatabaseService);
      await db.collection("preferences").deleteMany({});
      await db.collection("config").deleteMany({});
    } else {
      await module.get<pg.Pool>(PG_POOL).query("TRUNCATE preferences, configs");
    }
  });

  afterAll(() => module.close());

  describe("preference", () => {
    it("inserts a preference and finds it by id and scope", async () => {
      const inserted = await preferences.insert({scope: "bucket", language: {default: "en"}});

      expect(inserted._id).toBeDefined();
      expect(await preferences.findById(inserted._id)).toMatchObject({
        scope: "bucket",
        language: {default: "en"}
      });
      expect(String((await preferences.findByScope("bucket"))._id)).toBe(String(inserted._id));
      expect(await preferences.findByScope("nothing")).toBeNull();
      expect(
        await preferences.findById(module.get<IdTypes>(ID_TYPES).unscoped().generate())
      ).toBeNull();
    });

    it("inserts the preference of a scope when none exists", async () => {
      const stored = await preferences.replaceByScope("passport", {scope: "passport", a: 1});

      expect(stored).toMatchObject({scope: "passport", a: 1});
      expect(stored._id).toBeDefined();
    });

    it("replaces the preference of a scope and drops its previous properties", async () => {
      const first = await preferences.replaceByScope("passport", {scope: "passport", a: 1, b: 2});

      const second = await preferences.replaceByScope("passport", {scope: "passport", c: 3});

      expect(String(second._id)).toBe(String(first._id));
      expect(second).toMatchObject({scope: "passport", c: 3});
      expect(second).not.toHaveProperty("a");
      expect(second).not.toHaveProperty("b");
      expect(await preferences.findByScope("passport")).toMatchObject({c: 3});
    });

    it("keeps scopes apart", async () => {
      await preferences.replaceByScope("a", {scope: "a", value: 1});
      await preferences.replaceByScope("b", {scope: "b", value: 2});

      expect(await preferences.findByScope("a")).toMatchObject({value: 1});
      expect(await preferences.findByScope("b")).toMatchObject({value: 2});
    });
  });

  describe("config", () => {
    it("finds nothing for an unknown module", async () => {
      expect(await configs.findByModule("identity")).toBeNull();
    });

    it("sets the options of a module, inserting the config when missing", async () => {
      await configs.setOptions("identity", {password: {minLength: 8}});
      await configs.setOptions("identity", {password: {minLength: 12}, other: true});

      expect(await configs.findByModule("identity")).toMatchObject({
        module: "identity",
        options: {password: {minLength: 12}, other: true}
      });
    });

    it("sets one option and keeps the others", async () => {
      await configs.setOption("user", "rateLimits", {login: {limit: 5}});
      await configs.setOption("user", "verificationProcessMaxAttempt", 3);

      expect((await configs.findByModule("user")).options).toEqual({
        rateLimits: {login: {limit: 5}},
        verificationProcessMaxAttempt: 3
      });
    });

    it("sets a nested option by its dotted name", async () => {
      await configs.setOptions("user", {password: {minLength: 8, minNumber: 1}});

      await configs.setOption("user", "password.minLength", 10);

      expect((await configs.findByModule("user")).options).toEqual({
        password: {minLength: 10, minNumber: 1}
      });
    });

    it("replaces the config of a module and resolves to the stored one", async () => {
      await configs.setOptions("storage", {a: 1});

      const replaced = await configs.replaceByModule("storage", {
        module: "storage",
        options: {b: 2}
      });

      expect(replaced).toMatchObject({module: "storage", options: {b: 2}});
      expect((await configs.findByModule("storage")).options).toEqual({b: 2});
    });

    it("inserts the config when replacing a missing one", async () => {
      const replaced = await configs.replaceByModule("fresh", {module: "fresh", options: {a: 1}});

      expect(replaced).toMatchObject({module: "fresh", options: {a: 1}});
    });
  });
});
