import {Test} from "@nestjs/testing";
import {DuplicateKeyError} from "@spica-server/data";
import {
  MongoConfigRepository,
  MongoEnvVarRepository,
  MongoJobRepository,
  MongoPreferenceRepository,
  MongoSecretRepository,
  MongoStorageRepository
} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";

describe("system repositories", () => {
  let db: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    db = module.get(DatabaseService);
  });

  describe("config", () => {
    let configs: MongoConfigRepository;

    beforeEach(() => {
      configs = new MongoConfigRepository(db);
    });

    it("should insert the module's config when setting options or an option", async () => {
      await configs.setOption("user", "rateLimits", {limit: 1});
      await configs.setOptions("identity", {a: 1});

      expect(await configs.findByModule("user")).toEqual({
        _id: expect.any(ObjectId),
        module: "user",
        options: {rateLimits: {limit: 1}}
      });
      expect((await configs.findByModule("identity")).options).toEqual({a: 1});
    });

    it("should set one option without dropping the others", async () => {
      await configs.setOptions("user", {a: 1, b: 2});

      await configs.setOption("user", "b", 3);

      expect((await configs.findByModule("user")).options).toEqual({a: 1, b: 3});
    });

    it("should replace the module's config and resolve to the stored one", async () => {
      const inserted = await configs.replaceByModule("bucket", {module: "bucket", options: {x: 1}});
      const replaced = await configs.replaceByModule("bucket", {module: "bucket", options: {y: 2}});

      expect(inserted).toEqual(expect.objectContaining({options: {x: 1}}));
      expect(replaced).toEqual({_id: inserted["_id"], module: "bucket", options: {y: 2}});
    });
  });

  it("should resolve env var writes to the document after them", async () => {
    const envVars = new MongoEnvVarRepository(db);
    const {_id} = await envVars.insert({key: "a", value: "1"});

    expect(await envVars.updateById(_id, {value: "2"})).toEqual({_id, key: "a", value: "2"});
    expect(await envVars.replaceById(_id, {key: "b", value: "3"})).toEqual({
      _id,
      key: "b",
      value: "3"
    });
    expect(await envVars.updateById(new ObjectId(), {value: "x"})).toBeNull();
  });

  it("should resolve secret writes to the document before them", async () => {
    const secrets = new MongoSecretRepository(db);
    const value = {encrypted: "e", iv: "i", authTag: "t"} as any;
    const {_id} = await secrets.insert({key: "a", value});

    expect((await secrets.updateById(_id, {key: "b"})).key).toEqual("a");
    expect((await secrets.replaceById(_id, {key: "c", value})).key).toEqual("b");
    expect((await secrets.findById(_id)).key).toEqual("c");
  });

  it("should report duplicate env var keys as DuplicateKeyError", async () => {
    const envVars = new MongoEnvVarRepository(db);
    await db.collection("env_var").createIndex({key: 1}, {unique: true});
    await envVars.insert({key: "a", value: "1"});

    const error = await envVars.insert({key: "a", value: "2"}).catch(e => e);

    expect(error).toBeInstanceOf(DuplicateKeyError);
    expect(error.keyValue).toEqual({key: "a"});
  });

  it("should replace and find preferences by scope", async () => {
    const preferences = new MongoPreferenceRepository(db);

    const stored = await preferences.replaceByScope("bucket", {scope: "bucket", a: 1});

    expect(stored).toEqual({_id: expect.any(ObjectId), scope: "bucket", a: 1});
    expect(await preferences.findByScope("bucket")).toEqual(stored);
    expect(await preferences.findById(stored._id)).toEqual(stored);
  });

  it("should let only the first claim of a job win", async () => {
    const jobs = new MongoJobRepository(db, {expireAfterSeconds: 60});
    const meta = {_id: "1", event_id: "e1"};

    expect(await Promise.all([jobs.claim(meta), jobs.claim(meta)])).toEqual(
      expect.arrayContaining([true, false])
    );
    expect(await jobs.takeByEventId("e1")).toEqual(expect.objectContaining({_id: "1"}));
    expect(await jobs.takeByEventId("e1")).toBeNull();
  });

  describe("storage", () => {
    let storage: MongoStorageRepository;
    const object = (name: string, size = 1) => ({name, content: {type: "text/plain", size}});
    const names = async () =>
      (await db.collection("storage").find().sort({name: 1}).toArray()).map(o => o.name);

    beforeEach(async () => {
      storage = new MongoStorageRepository(db);
      await storage.insertAll([
        object("a/"),
        object("a/b.txt", 2),
        object("a/c/"),
        object("a/c/d.txt", 3),
        object("ab.txt", 4)
      ]);
    });

    it("should sum the object sizes", async () => {
      expect(await storage.totalSize()).toEqual(11);
    });

    it("should rename the object and the objects under it", async () => {
      await storage.renamePrefix("a/", "x/");

      expect(await names()).toEqual(["ab.txt", "x/", "x/b.txt", "x/c/", "x/c/d.txt"]);
    });

    it("should find and delete objects by name prefix", async () => {
      expect((await storage.findByNamePrefix("a/c/")).map(o => o.name)).toEqual([
        "a/c/",
        "a/c/d.txt"
      ]);

      expect(await storage.deleteByNamePrefix("a/c/")).toEqual(2);
      expect(await names()).toEqual(["a/", "a/b.txt", "ab.txt"]);
    });

    it("should browse the objects directly under the path", async () => {
      const browsed = await storage.browse({path: "a", sort: {name: 1}});

      expect(browsed.map(o => o.name)).toEqual(["a/b.txt", "a/c/"]);
    });

    it("should browse only the objects the resource filter allows", async () => {
      const browsed = await storage.browse({
        resourceFilter: {include: ["a/*"]},
        path: "a",
        sort: {name: 1}
      });

      expect(browsed.map(o => o.name)).toEqual(["a/b.txt", "a/c/"]);
      expect(await storage.browse({resourceFilter: {exclude: ["a/**"]}, path: "a"})).toEqual([]);
    });

    it("should report duplicate names as DuplicateKeyError", async () => {
      await db.collection("storage").createIndex({name: 1}, {unique: true});

      const error = await storage.insert(object("ab.txt")).catch(e => e);

      expect(error).toBeInstanceOf(DuplicateKeyError);
    });
  });
});
