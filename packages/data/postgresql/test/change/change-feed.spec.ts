import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository, idOf} from "@spica-server/data";
import {ORM, PostgresChangeFeed} from "@spica-server/data-postgresql";
import {Orm} from "@spica-server/data-postgresql-orm";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {BUCKET_SCHEMA_MANAGER, BucketSchemaManager} from "@spica-server/interface-bucket";
import {BUCKET_QUERY, BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {CHANGE_FEED, ChangeEvent, ChangeFeedOptions, PG_POOL} from "@spica-server/interface-data";
import {TRANSACTION_RUNNER} from "@spica-server/transaction";

const SETTLE_MS = 400;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("PostgreSQL change feed", () => {
  let module: TestingModule;
  let orm: Orm;
  let feed: PostgresChangeFeed;
  let manager: BucketSchemaManager;
  let writes: BucketWriteFacade;
  let inTransaction: (work: () => Promise<unknown>) => Promise<unknown>;
  let bucket: any;
  let table: string;
  const subscriptions: {unsubscribe(): void}[] = [];

  const definition = (extra: object = {}) => ({
    title: "Posts",
    description: "",
    icon: "",
    primary: "id",
    readOnly: false,
    history: false,
    order: 0,
    acl: {read: "true==true", write: "true==true"},
    properties: {
      id: {type: "uuid", options: {generated: true}},
      title: {type: "string"},
      tags: {type: "array", items: {type: "string"}},
      address: {type: "object", properties: {city: {type: "string"}}}
    },
    ...extra
  });

  const contextOf = (target: any) => ({resolveSchema: () => target, deleteOne: jest.fn()});
  const insert = (document: object, target = bucket) =>
    writes.insert(target, {...document}, {}, contextOf(target));
  const patch = (document: object, changes: object, target = bucket) =>
    writes.patch(target, document as any, changes, {}, contextOf(target));
  const remove = (key: unknown) => writes.delete(bucket, String(key), {}, contextOf(bucket));

  async function listen(
    options?: ChangeFeedOptions,
    source: PostgresChangeFeed = feed,
    collection = table
  ) {
    const events: ChangeEvent[] = [];
    subscriptions.push(source.watch(collection, options).subscribe(event => events.push(event)));
    await source.ready();
    await sleep(SETTLE_MS);
    return events;
  }

  async function eventually(events: ChangeEvent[], count: number) {
    for (let waited = 0; waited < 10_000 && events.length < count; waited += 50) {
      await sleep(50);
    }
    await sleep(SETTLE_MS);
    return events;
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_SCHEMA_MANAGER)]
    }).compile();
    await module.init();
    orm = module.get(ORM);
    feed = module.get(CHANGE_FEED);
    manager = module.get(BUCKET_SCHEMA_MANAGER);
    writes = module.get(BUCKET_WRITE);
    inTransaction = module.get(TRANSACTION_RUNNER);
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(async () => {
    bucket = await manager.create(definition() as any, () => {});
    table = `bucket_${idOf(bucket)}`;
  });

  afterEach(() => subscriptions.splice(0).forEach(subscription => subscription.unsubscribe()));

  describe("what is announced", () => {
    it("should announce one insert for a row with children", async () => {
      const events = await listen();

      const saved = await insert({title: "post", tags: ["a", "b"], address: {city: "Bonn"}});
      await eventually(events, 1);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        operation: "insert",
        key: String(saved.id),
        document: {title: "post", tags: ["a", "b"], address: {city: "Bonn"}}
      });
    });

    it("should leave the documents out when only keys are wanted", async () => {
      const events = await listen({keysOnly: true});

      const saved = await insert({title: "post", tags: ["a"]});
      await patch({...saved, title: "again"}, {title: "again"});
      await eventually(events, 2);

      expect(events.map(event => [event.operation, event.key])).toEqual([
        ["insert", String(saved.id)],
        ["update", String(saved.id)]
      ]);
      expect(events.every(event => event.document === undefined && !event.changes)).toBe(true);
    });

    it("should announce an update when only a list changes", async () => {
      const saved = await insert({title: "post", tags: ["a"]});
      const events = await listen({operations: ["update"], document: "current"});

      await patch({...saved, tags: ["a", "c"]}, {tags: ["a", "c"]});
      await eventually(events, 1);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        operation: "update",
        key: String(saved.id),
        document: {tags: ["a", "c"]},
        changes: {updated: {tags: ["a", "c"]}, removed: []}
      });
    });

    it("should report a field that was cleared as removed", async () => {
      const saved = await insert({title: "post", address: {city: "Bonn"}});
      const events = await listen({operations: ["update"]});

      const {title, ...cleared} = saved;
      await patch(cleared, {title: null});
      await eventually(events, 1);

      expect(events[0].changes).toEqual({updated: {}, removed: ["title"]});
    });

    it("should announce one delete for a row with children", async () => {
      const saved = await insert({title: "post", tags: ["a", "b"]});
      const events = await listen({operations: ["delete"]});

      await remove(saved.id);
      await eventually(events, 1);

      expect(events).toEqual([
        expect.objectContaining({operation: "delete", key: String(saved.id)})
      ]);
    });

    it("should announce nothing for a patch that changes no value", async () => {
      const saved = await insert({title: "same"});
      await sleep(SETTLE_MS);
      const events = await listen();

      await patch(saved, {title: "same"});
      await sleep(SETTLE_MS);

      expect(events).toEqual([]);
    });

    it("should announce the writes of anything that writes to the table", async () => {
      const events = await listen();
      const rows = orm.table(table);

      const {id} = await rows.insertRow({title: "direct"});
      await rows.updateRow("id", id, {title: "changed"});
      await rows.deleteWhere("id", id);
      await eventually(events, 3);

      expect(events.map(event => event.operation)).toEqual(["insert", "update", "delete"]);
      expect(events.every(event => event.key == id)).toBe(true);
    });
  });

  describe("large changes", () => {
    it("should report the whole document when too many columns changed to list them", async () => {
      const fields = Array.from({length: 250}, (_, index) => `a_rather_long_field_name_${index}`);
      const wide = {
        ...definition({
          properties: {
            id: {type: "uuid", options: {generated: true}},
            ...Object.fromEntries(fields.map(field => [field, {type: "string"}]))
          }
        }),
        id: undefined
      };
      const created = await manager.create(wide as any, () => {});
      const before = Object.fromEntries(fields.map(field => [field, "old"]));
      const after = Object.fromEntries(fields.map(field => [field, "new"]));
      const saved = await insert(before, created);
      await sleep(SETTLE_MS);
      const events = await listen(
        {operations: ["update"], document: "current"},
        feed,
        `bucket_${idOf(created)}`
      );

      await patch({...saved, ...after}, after, created);
      await eventually(events, 1);

      expect(events).toHaveLength(1);
      expect(events[0].changes.removed).toEqual([]);
      expect(events[0].changes.updated).toMatchObject({id: saved.id, ...after});
    });
  });

  describe("subscribers", () => {
    it("should read a changed row once however many subscribers wait for it", async () => {
      const read = jest.spyOn(module.get(BUCKET_QUERY), "findOne");
      try {
        const first = await listen({operations: ["insert"]});
        const second = await listen({operations: ["insert"]});
        read.mockClear();

        await insert({title: "shared"});
        await eventually(first, 1);
        await eventually(second, 1);

        expect(first).toHaveLength(1);
        expect(second).toHaveLength(1);
        expect(read).toHaveBeenCalledTimes(1);
      } finally {
        read.mockRestore();
      }
    });
  });

  describe("transactions", () => {
    it("should announce nothing for a rolled back write", async () => {
      const events = await listen();

      await inTransaction(async () => {
        await insert({title: "never"});
        throw new Error("abort");
      }).catch(() => undefined);
      await sleep(SETTLE_MS);

      expect(events).toEqual([]);
    });

    it("should announce the writes of a transaction in order", async () => {
      const events = await listen();

      await inTransaction(async () => {
        await insert({title: "first"});
        await insert({title: "second"});
      });
      await eventually(events, 2);

      expect(events.map(event => event.document?.title)).toEqual(["first", "second"]);
    });
  });

  describe("schema changes", () => {
    it("should keep announcing the tables a replace adds", async () => {
      const replaced = {
        ...definition({
          properties: {
            id: {type: "uuid", options: {generated: true}},
            title: {type: "string"},
            tags: {type: "array", items: {type: "string"}},
            labels: {type: "array", items: {type: "string"}}
          }
        }),
        id: idOf(bucket)
      };
      await manager.replace(idOf(bucket), replaced as any, () => {});
      const saved = await insert({title: "post"}, replaced);
      const events = await listen({operations: ["update"], document: "current"});

      await patch({...saved, labels: ["new"]}, {labels: ["new"]}, replaced);
      await eventually(events, 1);

      expect(events).toMatchObject([{operation: "update", changes: {updated: {labels: ["new"]}}}]);
    });

    it("should announce nothing for the rows a key change rewrites, and follow the new key", async () => {
      const keyed = (primary: string) =>
        definition({
          primary,
          required: ["code"],
          properties: {
            id: primary == "id" ? {type: "uuid", options: {generated: true}} : {type: "uuid"},
            code: {type: "string"},
            tags: {type: "array", items: {type: "string"}}
          }
        }) as any;
      const created = await manager.create(keyed("id"), () => {});
      await insert({code: "a", tags: ["x"]}, created);
      await insert({code: "b"}, created);
      await sleep(SETTLE_MS);
      const events = await listen(undefined, feed, `bucket_${idOf(created)}`);

      const rekeyed = {...keyed("code"), id: idOf(created)};
      await manager.replace(idOf(created), rekeyed, () => {});
      await sleep(SETTLE_MS);
      expect(events).toEqual([]);

      await insert({code: "c"}, rekeyed);
      await eventually(events, 1);
      expect(events).toMatchObject([{operation: "insert", key: "c"}]);
    });
  });

  describe("replicas", () => {
    it("should give two listeners the same id", async () => {
      const other = new PostgresChangeFeed(module.get(PG_POOL), orm, module.get(BUCKET_QUERY));
      try {
        const first = await listen({operations: ["insert"]});
        const second = await listen({operations: ["insert"]}, other);

        await insert({title: "shared", tags: ["a"]});
        await eventually(first, 1);
        await eventually(second, 1);

        expect(first).toHaveLength(1);
        expect(second.map(event => event.id)).toEqual(first.map(event => event.id));
      } finally {
        await other.onModuleDestroy();
      }
    });
  });

  describe("collections that are not tracked", () => {
    it("should never emit", async () => {
      const events: ChangeEvent[] = [];
      subscriptions.push(feed.watch("jobs").subscribe(event => events.push(event)));
      await insert({title: "other"});
      await sleep(SETTLE_MS);

      expect(events).toEqual([]);
    });
  });
});
