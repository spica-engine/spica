import {Test, TestingModule} from "@nestjs/testing";
import {FilterLanguageError, provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {BUCKET_SCHEMA_MANAGER, BucketSchemaManager} from "@spica-server/interface-bucket";
import {BUCKET_QUERY, BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {
  ChunkKind,
  REALTIME,
  Realtime,
  RealtimeOptions,
  StreamChunk
} from "@spica-server/interface-realtime";

const SETTLE_MS = 600;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until(condition: () => boolean) {
  for (let waited = 0; waited < 15_000 && !condition(); waited += 25) {
    await sleep(25);
  }
}

describe("PostgreSQL realtime", () => {
  let module: TestingModule;
  let realtime: Realtime;
  let manager: BucketSchemaManager;
  let writes: BucketWriteFacade;
  let bucket: any;
  const subscriptions: {unsubscribe(): void}[] = [];

  const definition = (read: string) =>
    ({
      title: "Posts",
      description: "",
      icon: "",
      primary: "id",
      readOnly: false,
      history: false,
      order: 0,
      acl: {read, write: "true==true"},
      properties: {
        id: {type: "uuid", options: {generated: true}},
        age: {type: "number"},
        title: {type: "string"}
      }
    }) as any;

  const context = () => ({resolveSchema: () => bucket, deleteOne: jest.fn()});
  const insert = (document: object) => writes.insert(bucket, {...document}, {}, context());
  const patch = (document: object, changes: object) =>
    writes.patch(bucket, document as any, changes, {}, context());

  async function open(options: RealtimeOptions = {}, name = `bucket_${bucket._id}`) {
    const chunks: StreamChunk<any>[] = [];
    const errors: any[] = [];
    subscriptions.push(
      realtime.find(name, options).subscribe({
        next: chunk => chunks.push(chunk),
        error: error => errors.push(error)
      })
    );
    await until(
      () => errors.length > 0 || chunks.some(chunk => chunk.kind == ChunkKind.EndOfInitial)
    );
    await sleep(SETTLE_MS);
    const mark = chunks.length;
    return {chunks, errors, live: () => chunks.slice(mark)};
  }

  const titles = (chunks: StreamChunk<any>[], kind: ChunkKind) =>
    chunks.filter(chunk => chunk.kind == kind).map(chunk => chunk.document.title);

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_SCHEMA_MANAGER)]
    }).compile();
    await module.init();
    realtime = module.get(REALTIME);
    manager = module.get(BUCKET_SCHEMA_MANAGER);
    writes = module.get(BUCKET_WRITE);
  }, 120_000);

  afterAll(() => module.close());

  afterEach(() => subscriptions.splice(0).forEach(subscription => subscription.unsubscribe()));

  describe("the read rule", () => {
    beforeEach(async () => {
      bucket = await manager.create(
        definition(`document.age > 20 || auth.role == "admin"`),
        () => {}
      );
    });

    it("should send only the documents the user may read", async () => {
      await insert({age: 10, title: "young"});
      await insert({age: 30, title: "old"});

      const {chunks} = await open({applyAcl: true, user: {role: "member"}});

      expect(titles(chunks, ChunkKind.Initial)).toEqual(["old"]);
    });

    it("should send everything to a user the rule lets in", async () => {
      await insert({age: 10, title: "young"});
      await insert({age: 30, title: "old"});

      const {chunks} = await open({applyAcl: true, user: {role: "admin"}});

      expect(titles(chunks, ChunkKind.Initial).sort()).toEqual(["old", "young"]);
    });

    it("should not apply the rule unless asked", async () => {
      await insert({age: 10, title: "young"});

      const {chunks} = await open({user: {role: "member"}});

      expect(titles(chunks, ChunkKind.Initial)).toEqual(["young"]);
    });

    it("should keep the rule for the changes that follow", async () => {
      const {live} = await open({applyAcl: true, user: {role: "member"}});

      const hidden = await insert({age: 10, title: "hidden"});
      const shown = await insert({age: 40, title: "shown"});
      await until(() => live().length > 0);
      await sleep(SETTLE_MS);

      expect(titles(live(), ChunkKind.Insert)).toEqual(["shown"]);

      await patch({...shown, age: 5}, {age: 5});
      await until(() => live().some(chunk => chunk.kind == ChunkKind.Expunge));
      expect(live().map(chunk => ChunkKind[chunk.kind])).toEqual(["Insert", "Expunge"]);
      expect(hidden).toBeDefined();
    });
  });

  describe("a filter", () => {
    beforeEach(async () => {
      bucket = await manager.create(definition("true==true"), () => {});
    });

    it("should be an expression", async () => {
      await insert({age: 10, title: "a"});
      await insert({age: 30, title: "b"});

      const {chunks} = await open({filter: `document.age > 20`});

      expect(titles(chunks, ChunkKind.Initial)).toEqual(["b"]);
    });

    it("should be refused when it is a MongoDB filter", async () => {
      const {errors} = await open({filter: {age: {$gt: 20}}});

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FilterLanguageError);
    });
  });

  describe("a collection that is not a bucket", () => {
    it("should be refused for now", async () => {
      const {errors} = await open({}, "function");

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({status: 501});
    });
  });

  describe("a bucket that does not exist", () => {
    it("should be answered with a missing bucket", async () => {
      const {errors} = await open({}, "bucket_01900000-0000-7000-8000-000000000000");

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({status: 404});
    });
  });

  describe("the work behind many subscribers", () => {
    let find: jest.SpyInstance;

    beforeEach(async () => {
      bucket = await manager.create(definition("true==true"), () => {});
      find = jest.spyOn(module.get(BUCKET_QUERY), "find");
    });

    afterEach(() => find.mockRestore());

    it("should read once for subscribers that ask the same thing", async () => {
      await insert({age: 10, title: "a"});
      const options = {filter: `document.age > 20`};
      const streams = [await open(options), await open(options), await open(options)];
      find.mockClear();

      await insert({age: 30, title: "b"});
      await until(() => streams.every(stream => stream.live().length > 0));
      await sleep(SETTLE_MS);

      expect(streams.map(stream => titles(stream.live(), ChunkKind.Insert))).toEqual([
        ["b"],
        ["b"],
        ["b"]
      ]);
      expect(find).toHaveBeenCalledTimes(2);
    });

    it("should read for each user when the read rule differs", async () => {
      bucket = await manager.create(
        definition(`document.age > 20 || auth.role == "admin"`),
        () => {}
      );
      find.mockClear();
      const users = [{role: "a"}, {role: "b"}, {role: "c"}];
      const streams = [];
      for (const user of users) {
        streams.push(await open({applyAcl: true, user}));
      }
      find.mockClear();

      await insert({age: 30, title: "b"});
      await until(() => streams.every(stream => stream.live().length > 0));
      await sleep(SETTLE_MS);

      expect(find).toHaveBeenCalledTimes(1 + users.length);
    });

    it("should not read for an update that leaves out what the subscription depends on", async () => {
      const saved = await insert({age: 30, title: "first"});
      find.mockClear();
      const written = await patch({...saved, title: "second"}, {title: "second"});
      const costOfTheWrite = find.mock.calls.length;
      await sleep(SETTLE_MS);
      const {live} = await open({filter: `document.age > 20`});
      find.mockClear();

      await patch({...written, title: "third"}, {title: "third"});
      await until(() => live().length > 0);
      await sleep(SETTLE_MS);

      expect(live().map(chunk => ChunkKind[chunk.kind])).toEqual(["Update"]);
      expect(live()[0].document.title).toEqual("third");
      expect(find).toHaveBeenCalledTimes(costOfTheWrite + 1);
    });

    it("should read when an update changes what the subscription depends on", async () => {
      const saved = await insert({age: 30, title: "x"});
      const {live} = await open({filter: `document.age > 20`});
      find.mockClear();

      await patch({...saved, age: 5}, {age: 5});
      await until(() => live().length > 0);
      await sleep(SETTLE_MS);

      expect(live().map(chunk => ChunkKind[chunk.kind])).toEqual(["Expunge"]);
      expect(find.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe("the document sent for an update that cannot matter", () => {
    const created = (properties: object, read = "true==true") =>
      manager.create(
        {
          ...definition(read),
          properties: {id: {type: "uuid", options: {generated: true}}, ...properties}
        },
        () => {}
      );

    it("should leave out the fields the read rule hides from the user", async () => {
      bucket = await created({
        age: {type: "number"},
        title: {type: "string"},
        secret: {type: "string", acl: `auth.role == "admin"`}
      });
      const saved = await insert({age: 30, title: "first", secret: "hidden"});
      const member = await open({
        applyAcl: true,
        user: {role: "member"},
        filter: `document.age > 20`
      });
      const admin = await open({
        applyAcl: true,
        user: {role: "admin"},
        filter: `document.age > 20`
      });

      await patch({...saved, title: "second"}, {title: "second"});
      await until(() => member.live().length > 0 && admin.live().length > 0);

      expect(member.live()).toHaveLength(1);
      expect(member.live()[0].document).toMatchObject({title: "second"});
      expect(member.live()[0].document).not.toHaveProperty("secret");
      expect(admin.live()[0].document).toMatchObject({title: "second", secret: "hidden"});
    });

    it("should be the document a new subscriber is sent", async () => {
      bucket = await created({
        age: {type: "number"},
        title: {type: "string"},
        tags: {type: "array", items: {type: "string"}},
        address: {type: "object", properties: {city: {type: "string"}}},
        born: {type: "date"}
      });
      const saved = await insert({
        age: 30,
        title: "first",
        tags: ["a", "b"],
        address: {city: "Bonn"},
        born: new Date("2020-01-02T03:04:05.000Z")
      });
      const watcher = await open({filter: `document.age > 20`});

      await patch({...saved, title: "second"}, {title: "second"});
      await until(() => watcher.live().length > 0);
      const fresh = await open({filter: `document.age > 20`});

      const sent = watcher.live()[0].document;
      const initial = fresh.chunks.find(chunk => chunk.kind == ChunkKind.Initial)!.document;
      expect(sent).toEqual(initial);
    });
  });

  describe("users that each read their own documents", () => {
    const users = Array.from({length: 20}, (_, index) => `u${index + 1}`);
    let find: jest.SpyInstance;
    let streams: Record<string, Awaited<ReturnType<typeof open>>>;

    beforeEach(async () => {
      bucket = await manager.create(
        {
          ...definition(`document.owner == auth._id`),
          properties: {
            id: {type: "uuid", options: {generated: true}},
            owner: {type: "string"},
            title: {type: "string"}
          }
        },
        () => {}
      );
      streams = {};
      for (const user of users) {
        streams[user] = await open({applyAcl: true, user: {_id: user}});
      }
      find = jest.spyOn(module.get(BUCKET_QUERY), "find");
    });

    afterEach(() => find.mockRestore());

    it("should ask the database only for the owner when a document is added", async () => {
      await insert({owner: "u3", title: "Buy milk"});
      await until(() => streams.u3.live().length > 0);
      await sleep(SETTLE_MS);

      expect(titles(streams.u3.live(), ChunkKind.Insert)).toEqual(["Buy milk"]);
      expect(users.filter(user => user != "u3").flatMap(user => streams[user].live())).toEqual([]);
      expect(find).toHaveBeenCalledTimes(2);
    });

    it("should take a document from its old owner and give it to the new one", async () => {
      const saved = await insert({owner: "u3", title: "Buy milk"});
      await until(() => streams.u3.live().length > 0);
      find.mockClear();

      await patch({...saved, owner: "u7"}, {owner: "u7"});
      await until(() => streams.u3.live().length > 1 && streams.u7.live().length > 0);
      await sleep(SETTLE_MS);

      expect(streams.u3.live().map(chunk => ChunkKind[chunk.kind])).toEqual(["Insert", "Expunge"]);
      expect(streams.u7.live().map(chunk => ChunkKind[chunk.kind])).toEqual(["Insert"]);
      expect(streams.u7.live()[0].document.title).toEqual("Buy milk");
      expect(
        users.filter(user => !["u3", "u7"].includes(user)).flatMap(user => streams[user].live())
      ).toEqual([]);
      expect(find).toHaveBeenCalledTimes(3);
    });

    it("should still tell the owner about a delete", async () => {
      const saved = await insert({owner: "u5", title: "Gone soon"});
      await until(() => streams.u5.live().length > 0);

      await writes.delete(bucket, String(saved.id), {}, context());
      await until(() => streams.u5.live().length > 1);

      expect(streams.u5.live().map(chunk => ChunkKind[chunk.kind])).toEqual(["Insert", "Delete"]);
    });
  });
});
