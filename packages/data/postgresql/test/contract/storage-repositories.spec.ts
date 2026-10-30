import {Test, TestingModule} from "@nestjs/testing";
import {DuplicateKeyError, provideRepository} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {
  ACTIVITY_OPTIONS,
  ACTIVITY_REPOSITORY,
  Action,
  ActivityRepository
} from "@spica-server/interface-activity";
import {ASSET_REPOSITORY, AssetRepository} from "@spica-server/interface-asset";
import {ID_TYPES, IdType, IdTypes} from "@spica-server/interface-data";
import {
  COMMAND_REPOSITORY,
  CommandRepository,
  JOB_REPOSITORY,
  JobRepository,
  REPLICATION_SERVICE_OPTIONS
} from "@spica-server/interface-replication";
import {STORAGE_REPOSITORY, StorageRepository} from "@spica-server/interface-storage";
import {clearStorage, waitForMongoIndexes} from "./support.js";

contractSuite("storage, activity and replication repositories", engine => {
  let module: TestingModule;
  let idType: IdType;
  let activities: ActivityRepository;
  let commands: CommandRepository;
  let jobs: JobRepository;
  let storage: StorageRepository;
  let assets: AssetRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [
        {provide: ACTIVITY_OPTIONS, useValue: {expireAfterSeconds: 3600}},
        {provide: REPLICATION_SERVICE_OPTIONS, useValue: {expireAfterSeconds: 3600}},
        provideRepository(ACTIVITY_REPOSITORY),
        provideRepository(COMMAND_REPOSITORY),
        provideRepository(JOB_REPOSITORY),
        provideRepository(STORAGE_REPOSITORY),
        provideRepository(ASSET_REPOSITORY)
      ]
    }).compile();
    await module.init();
    await waitForMongoIndexes(engine, module, {storage: ["name_1"]});

    idType = module.get<IdTypes>(ID_TYPES).unscoped();
    activities = module.get(ACTIVITY_REPOSITORY);
    commands = module.get(COMMAND_REPOSITORY);
    jobs = module.get(JOB_REPOSITORY);
    storage = module.get(STORAGE_REPOSITORY);
    assets = module.get(ASSET_REPOSITORY);
  }, 120_000);

  beforeEach(() =>
    clearStorage(engine, module, {
      mongodb: ["activity", "commands", "jobs", "storage", "asset"],
      postgresql: ["activities", "commands", "jobs", "storage_objects", "assets"]
    })
  );

  afterAll(() => module.close());

  const missingId = () => idType.generate();

  describe("activity", () => {
    const activity = (action: Action, resource: string[]) => ({
      action,
      identifier: missingId(),
      resource,
      created_at: new Date()
    });

    it("inserts activities and resolves to their ids", async () => {
      const ids = await activities.insertMany([
        activity(Action.POST, ["bucket", "1"]),
        activity(Action.PUT, ["function", "2"])
      ]);

      expect(ids).toHaveLength(2);
      expect(String(ids[0])).not.toBe(String(ids[1]));
      expect(ids.every(id => idType.isValid(String(id)))).toBe(true);
    });

    it("deletes activities by id", async () => {
      const [first, second, third] = await activities.insertMany([
        activity(Action.POST, ["a"]),
        activity(Action.POST, ["b"]),
        activity(Action.DELETE, ["c"])
      ]);

      expect(await activities.deleteById(first)).toBe(1);
      expect(await activities.deleteById(first)).toBe(0);
      expect(await activities.deleteByIds([second, third, missingId()])).toBe(2);
      expect(await activities.deleteByIds([])).toBe(0);
    });
  });

  describe("replication", () => {
    const command = () => ({
      source: {command: {class: "A", handler: "run", args: [1, {a: 2}]}, id: "replica-1"},
      target: {commands: [{class: "A", handler: "run", args: [1]}], id: "replica-2"}
    });

    it("stores command messages", async () => {
      await expect(commands.insert(command())).resolves.toBeDefined();
      await expect(commands.insert({...command(), created_at: new Date()})).resolves.toBeDefined();
    });

    it("claims a job once", async () => {
      expect(await jobs.claim({_id: "job-1"})).toBe(true);
      expect(await jobs.claim({_id: "job-1"})).toBe(false);
      expect(await jobs.claim({_id: "job-2"})).toBe(true);
    });

    it("lets only one of many concurrent claims win", async () => {
      const results = await Promise.all(
        Array.from({length: 10}, () => jobs.claim({_id: "contended", event_id: "e"}))
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("takes the job of an event once, with everything it was claimed with", async () => {
      await jobs.claim({_id: "job-1", event_id: "event-1", change: {kind: "insert", n: 2}});
      await jobs.claim({_id: "job-2", event_id: "event-2"});

      const taken = await jobs.takeByEventId("event-1");

      expect(taken).toMatchObject({
        _id: "job-1",
        event_id: "event-1",
        change: {kind: "insert", n: 2}
      });
      expect(new Date(taken.created_at).getTime()).not.toBeNaN();
      expect(await jobs.takeByEventId("event-1")).toBeNull();
      expect(await jobs.takeByEventId("event-2")).toMatchObject({_id: "job-2"});
      expect(await jobs.takeByEventId("unknown")).toBeNull();
    });
  });

  describe("asset", () => {
    const asset = (name: string, url = `https://assets/${name}`) => ({
      name,
      description: `${name} asset`,
      url,
      icon: "extension",
      status: "downloaded" as const,
      resources: [{_id: "1", module: "bucket", contents: {schema: {title: name}}}] as any,
      configs: []
    });

    it("inserts, finds and lists assets", async () => {
      const first = await assets.insert(asset("a"));
      await assets.insert(asset("b"));

      expect(first._id).toBeDefined();
      expect(await assets.findById(first._id)).toMatchObject(asset("a"));
      expect((await assets.find()).map(a => a.name)).toEqual(["a", "b"]);
      expect((await assets.find({})).map(a => a.name)).toEqual(["a", "b"]);
      expect(await assets.findById(missingId())).toBeNull();
    });

    it("finds the versions of an asset by its url", async () => {
      await assets.insert(asset("v1", "https://assets/same"));
      await assets.insert(asset("v2", "https://assets/same"));
      await assets.insert(asset("other"));

      expect((await assets.findVersions("https://assets/same")).map(a => a.name)).toEqual([
        "v1",
        "v2"
      ]);
    });

    it("updates and replaces an asset, resolving to it as it was", async () => {
      const {_id} = await assets.insert(asset("a"));

      expect(await assets.updateById(_id, {status: "installed"})).toMatchObject({
        status: "downloaded"
      });
      expect(await assets.replaceById(_id, asset("b"))).toMatchObject({
        name: "a",
        status: "installed"
      });
      expect(await assets.findById(_id)).toMatchObject({name: "b", status: "downloaded"});
      expect(await assets.updateById(missingId(), {status: "installed"})).toBeNull();
      expect(await assets.replaceById(missingId(), asset("x"))).toBeNull();
    });

    it("deletes an asset and resolves to it", async () => {
      const {_id} = await assets.insert(asset("a"));

      expect(await assets.deleteById(_id)).toMatchObject({name: "a"});
      expect(await assets.deleteById(_id)).toBeNull();
    });
  });

  describe("storage", () => {
    const object = (name: string, size = 10, type = "text/plain") => ({
      name,
      url: `https://storage/${name}`,
      created_at: new Date("2024-01-01T00:00:00Z"),
      updated_at: new Date("2024-01-02T00:00:00Z"),
      content: {type, size}
    });

    async function seed(names: string[]) {
      for (const name of names) {
        await storage.insert(object(name));
      }
    }

    const names = (objects: {name: string}[]) => objects.map(o => o.name);

    it("inserts an object and finds it by id and name", async () => {
      const inserted = await storage.insert(object("a.txt"));

      expect(inserted._id).toBeDefined();
      expect(await storage.findById(inserted._id)).toMatchObject(object("a.txt"));
      expect(String((await storage.findByName("a.txt"))._id)).toBe(String(inserted._id));
      expect(await storage.findByName("nope")).toBeNull();
      expect(await storage.findById(missingId())).toBeNull();
    });

    it("reports duplicate names as DuplicateKeyError", async () => {
      await storage.insert(object("a.txt"));

      const single = await storage.insert(object("a.txt")).catch(e => e);
      const many = await storage.insertAll([object("b.txt"), object("a.txt")]).catch(e => e);

      expect(single).toBeInstanceOf(DuplicateKeyError);
      expect(single.keyValue).toEqual({name: "a.txt"});
      expect(many).toBeInstanceOf(DuplicateKeyError);
    });

    it("inserts many objects and resolves to them with their ids", async () => {
      const inserted = await storage.insertAll([object("a.txt"), object("b.txt")]);

      expect(names(inserted)).toEqual(["a.txt", "b.txt"]);
      expect(inserted.every(o => o._id !== undefined)).toBe(true);
      expect(String(inserted[0]._id)).not.toBe(String(inserted[1]._id));
    });

    it("finds objects by ids and names", async () => {
      const [a, b] = await storage.insertAll([object("a.txt"), object("b.txt"), object("c.txt")]);

      expect(names(await storage.findByIds([a._id, b._id, missingId()]))).toEqual([
        "a.txt",
        "b.txt"
      ]);
      expect(names(await storage.findByNames(["c.txt", "a.txt", "nope"]))).toEqual([
        "a.txt",
        "c.txt"
      ]);
      expect(await storage.findByIds([])).toEqual([]);
    });

    it("finds, counts and deletes objects by name prefix, escaping the prefix", async () => {
      await seed(["docs/", "docs/a.txt", "docs/sub/", "docs/sub/b.txt", "docsx.txt", "a.b", "axb"]);

      expect(names(await storage.findByNamePrefix("docs/")).sort()).toEqual([
        "docs/",
        "docs/a.txt",
        "docs/sub/",
        "docs/sub/b.txt"
      ]);
      expect(names(await storage.findByNamePrefix("a.")).sort()).toEqual(["a.b"]);
      expect(await storage.deleteByNamePrefix("docs/")).toBe(4);
      expect(await storage.deleteByNamePrefix("docs/")).toBe(0);
      expect((await storage.findByName("docsx.txt")).name).toBe("docsx.txt");
    });

    it("sums the size of all objects", async () => {
      expect(await storage.totalSize()).toBe(0);
      await storage.insert(object("a.txt", 10));
      await storage.insert(object("b.txt", 25));

      expect(await storage.totalSize()).toBe(35);
    });

    it("updates the fields of an object", async () => {
      const {_id} = await storage.insert(object("a.txt"));

      await storage.updateById(_id, {content: {type: "text/csv", size: 99}});

      expect((await storage.findById(_id)).content).toEqual({type: "text/csv", size: 99});
    });

    it("renames an object and the objects under it", async () => {
      await seed(["docs/", "docs/a.txt", "docs/sub/b.txt", "other/", "docsx.txt"]);

      await storage.renamePrefix("docs/", "papers/");

      expect(names(await storage.findByNamePrefix("papers/")).sort()).toEqual([
        "papers/",
        "papers/a.txt",
        "papers/sub/b.txt"
      ]);
      expect(await storage.findByName("docs/")).toBeNull();
      expect(await storage.findByName("docsx.txt")).not.toBeNull();
      expect(await storage.findByName("other/")).not.toBeNull();
    });

    it("renames a single object", async () => {
      await seed(["a.txt", "a.txt.bak"]);

      await storage.renamePrefix("a.txt", "b.txt");

      expect((await storage.findByNamePrefix("b.txt")).map(o => o.name).sort()).toEqual([
        "b.txt",
        "b.txt.bak"
      ]);
    });

    it("deletes objects and resolves to the deleted ones", async () => {
      const [a, b, c] = await storage.insertAll([
        object("a.txt"),
        object("b.txt"),
        object("c.txt")
      ]);

      expect(await storage.deleteById(a._id)).toMatchObject({name: "a.txt"});
      expect(await storage.deleteById(a._id)).toBeNull();
      expect(await storage.deleteByName("b.txt")).toMatchObject({name: "b.txt"});
      expect(await storage.deleteByName("b.txt")).toBeNull();
      expect(await storage.deleteByIds([c._id, a._id])).toBe(1);
    });

    describe("browse", () => {
      const tree = [
        "a.txt",
        "folder/",
        "folder/b.txt",
        "folder/sub/",
        "folder/sub/c.txt",
        "other/",
        "other/d.txt",
        "docs.v1/",
        "docs.v1/e.txt"
      ];

      beforeEach(() => seed(tree));

      it("lists the top level", async () => {
        expect(names(await storage.browse({})).sort()).toEqual([
          "a.txt",
          "docs.v1/",
          "folder/",
          "other/"
        ]);
        expect(names(await storage.browse({path: "/"})).sort()).toEqual([
          "a.txt",
          "docs.v1/",
          "folder/",
          "other/"
        ]);
      });

      it("lists the objects directly under a path", async () => {
        expect(names(await storage.browse({path: "folder"})).sort()).toEqual([
          "folder/b.txt",
          "folder/sub/"
        ]);
        expect(names(await storage.browse({path: "/folder/sub"}))).toEqual(["folder/sub/c.txt"]);
        expect(await storage.browse({path: "docs"})).toEqual([]);
        expect(names(await storage.browse({path: "docs.v1"}))).toEqual(["docs.v1/e.txt"]);
      });

      it("sorts, skips and limits", async () => {
        expect(names(await storage.browse({sort: {name: 1}}))).toEqual([
          "a.txt",
          "docs.v1/",
          "folder/",
          "other/"
        ]);
        expect(names(await storage.browse({sort: {name: -1}, skip: 1, limit: 2}))).toEqual([
          "folder/",
          "docs.v1/"
        ]);
        expect(
          names(await storage.browse({path: "folder", sort: {"content.size": -1}, limit: 1}))
        ).toHaveLength(1);
      });

      it("keeps the objects an include pattern allows", async () => {
        const browse = (include: string[], path?: string) =>
          storage.browse({resourceFilter: {include}, path}).then(names);

        expect((await browse(["a.txt"])).sort()).toEqual(["a.txt"]);
        expect((await browse(["folder/b.txt"])).sort()).toEqual(["folder/"]);
        expect((await browse(["folder/b.txt"], "folder")).sort()).toEqual(["folder/b.txt"]);
        expect((await browse(["folder/**"])).sort()).toEqual(["folder/"]);
        expect((await browse(["folder/**"], "folder")).sort()).toEqual([
          "folder/b.txt",
          "folder/sub/"
        ]);
        expect((await browse(["folder/*"], "folder")).sort()).toEqual([
          "folder/b.txt",
          "folder/sub/"
        ]);
        expect((await browse(["folder/*"])).sort()).toEqual([]);
        expect((await browse(["*"])).sort()).toEqual(["a.txt", "docs.v1/", "folder/", "other/"]);
        expect((await browse(["**"])).sort()).toEqual(["a.txt", "docs.v1/", "folder/", "other/"]);
        expect((await browse(["a.txt", "other/**"])).sort()).toEqual(["a.txt", "other/"]);
      });

      it("drops the objects an exclude pattern forbids", async () => {
        const browse = (exclude: string[], path?: string) =>
          storage.browse({resourceFilter: {exclude}, path}).then(names);

        expect((await browse(["a.txt"])).sort()).toEqual(["docs.v1/", "folder/", "other/"]);
        expect((await browse(["other/**"])).sort()).toEqual(["a.txt", "docs.v1/", "folder/"]);
        expect((await browse(["folder/b.txt"], "folder")).sort()).toEqual(["folder/sub/"]);
        expect((await browse(["folder/*"], "folder")).sort()).toEqual([]);
        expect((await browse(["docs.v1/**"])).sort()).toEqual(["a.txt", "folder/", "other/"]);
        expect((await browse(["**"])).sort()).toEqual([]);
      });

      it("combines include and exclude patterns", async () => {
        const result = await storage.browse({
          resourceFilter: {include: ["folder/**", "other/**"], exclude: ["other/**"]},
          path: undefined
        });

        expect(names(result)).toEqual(["folder/"]);
      });

      it("treats an empty resource filter as no restriction", async () => {
        expect(
          names(await storage.browse({resourceFilter: {include: [], exclude: []}})).sort()
        ).toEqual(["a.txt", "docs.v1/", "folder/", "other/"]);
      });
    });
  });
});
