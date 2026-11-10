import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {BUCKET_QUERY, BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {BUCKET_SCHEMA_MANAGER, BucketSchemaManager} from "@spica-server/interface-bucket";
import {CHANGE_FEED, ChangeEvent, ChangeFeedOptions, PG_POOL} from "@spica-server/interface-data";
import {ORM, PostgresChangeFeed} from "@spica-server/data-postgresql";
import {Orm} from "@spica-server/data-postgresql-orm";
import pg from "pg";

const SETTLE_MS = 400;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("PostgreSQL change feed", () => {
  let module: TestingModule;
  let pool: pg.Pool;
  let feed: PostgresChangeFeed;
  let manager: BucketSchemaManager;
  let writes: BucketWriteFacade;
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

  const context = () => ({resolveSchema: () => bucket, deleteOne: jest.fn()});
  const insert = (document: object) => writes.insert(bucket, {...document}, {}, context());

  async function listen(options?: ChangeFeedOptions, source: PostgresChangeFeed = feed) {
    const events: ChangeEvent[] = [];
    subscriptions.push(source.watch(table, options).subscribe(event => events.push(event)));
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
    pool = module.get(PG_POOL);
    feed = module.get(CHANGE_FEED);
    manager = module.get(BUCKET_SCHEMA_MANAGER);
    writes = module.get(BUCKET_WRITE);
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(async () => {
    bucket = await manager.create(definition() as any, () => {});
    table = `bucket_${bucket._id}`;
  });

  afterEach(() => subscriptions.splice(0).forEach(subscription => subscription.unsubscribe()));

  describe("triggers", () => {
    const triggersOf = async (name: string) => {
      const {rows} = await pool.query(
        "SELECT tgname FROM pg_trigger WHERE tgrelid = to_regclass($1) AND NOT tgisinternal",
        [`"${name}"`]
      );
      return rows.map(row => row.tgname);
    };

    it("should be on the main table and every child table", async () => {
      expect(await triggersOf(table)).toEqual(["spica_change"]);
      expect(await triggersOf(`${table}__tags`)).toEqual(["spica_change"]);
    });

    it("should follow the schema through a replace", async () => {
      await manager.replace(
        bucket._id,
        definition({
          properties: {
            id: {type: "uuid", options: {generated: true}},
            title: {type: "string"},
            tags: {type: "array", items: {type: "string"}},
            labels: {type: "array", items: {type: "string"}}
          }
        }) as any,
        () => {}
      );

      expect(await triggersOf(table)).toEqual(["spica_change"]);
      expect(await triggersOf(`${table}__labels`)).toEqual(["spica_change"]);
    });

    it("should not announce the rows a key change rewrites, and follow the new key", async () => {
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
      const keyedTable = `bucket_${created._id}`;
      await pool.query(`INSERT INTO "${keyedTable}" (code) VALUES ('a'), ('b')`);
      const events: ChangeEvent[] = [];
      subscriptions.push(feed.watch(keyedTable).subscribe(event => events.push(event)));
      await feed.ready();
      await sleep(SETTLE_MS);

      await manager.replace(created._id, keyed("code"), () => {});
      await sleep(SETTLE_MS);
      expect(events).toEqual([]);

      await pool.query(`INSERT INTO "${keyedTable}" (code, id) VALUES ('c', gen_random_uuid())`);
      await eventually(events, 1);
      expect(events).toMatchObject([{operation: "insert", key: "c"}]);
    });
  });

  describe("events", () => {
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

    it("should announce an update when only a child table changes", async () => {
      const saved = await insert({title: "post", tags: ["a"]});
      const events = await listen({operations: ["update"], document: "current"});

      await writes.patch(bucket, {...saved, tags: ["a", "c"]}, {tags: ["a", "c"]}, {}, context());
      await eventually(events, 1);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        operation: "update",
        key: String(saved.id),
        document: {tags: ["a", "c"]},
        changes: {updated: {tags: ["a", "c"]}, removed: []}
      });
    });

    it("should report fields set to null as removed", async () => {
      const saved = await insert({title: "post", address: {city: "Bonn"}});
      const events = await listen({operations: ["update"]});

      await pool.query(`UPDATE "${table}" SET title = NULL WHERE id = $1`, [saved.id]);
      await eventually(events, 1);

      expect(events[0].changes).toEqual({updated: {}, removed: ["title"]});
    });

    it("should announce one delete for a row with children", async () => {
      const saved = await insert({title: "post", tags: ["a", "b"]});
      const events = await listen({operations: ["delete"]});

      await writes.delete(bucket, String(saved.id), {}, context());
      await eventually(events, 1);

      expect(events).toEqual([
        expect.objectContaining({operation: "delete", key: String(saved.id)})
      ]);
    });

    it("should see writes made directly in SQL", async () => {
      const events = await listen();

      const {
        rows: [{id}]
      } = await pool.query(`INSERT INTO "${table}" (title) VALUES ('direct') RETURNING id`);
      await pool.query(`UPDATE "${table}" SET title = 'changed' WHERE id = $1`, [id]);
      await pool.query(`DELETE FROM "${table}" WHERE id = $1`, [id]);
      await eventually(events, 3);

      expect(events.map(event => event.operation)).toEqual(["insert", "update", "delete"]);
      expect(events.every(event => event.key == id)).toBe(true);
    });

    it("should announce nothing for an update that changes no value", async () => {
      const saved = await insert({title: "same"});
      await sleep(SETTLE_MS);
      const events = await listen();

      await pool.query(`UPDATE "${table}" SET title = title WHERE id = $1`, [saved.id]);
      await sleep(SETTLE_MS);

      expect(events).toEqual([]);
    });

    it("should announce nothing for a rolled back write", async () => {
      const events = await listen();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`INSERT INTO "${table}" (title) VALUES ('never')`);
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
      await sleep(SETTLE_MS);

      expect(events).toEqual([]);
    });

    it("should announce the writes of a transaction in order", async () => {
      const events = await listen();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`INSERT INTO "${table}" (title) VALUES ('first')`);
        await client.query(`INSERT INTO "${table}" (title) VALUES ('second')`);
        await client.query("COMMIT");
      } finally {
        client.release();
      }
      await eventually(events, 2);

      expect(events.map(event => event.document?.title)).toEqual(["first", "second"]);
    });
  });

  describe("replicas", () => {
    it("should give two listeners the same id", async () => {
      const other = new PostgresChangeFeed(pool, module.get<Orm>(ORM), module.get(BUCKET_QUERY));
      try {
        const first = await listen({operations: ["insert"]});
        const second = await listen({operations: ["insert"]}, other);

        await insert({title: "shared", tags: ["a"]});
        await eventually(first, 1);
        await eventually(second, 1);

        expect(second.map(event => event.id)).toEqual(first.map(event => event.id));
        expect(first).toHaveLength(1);
      } finally {
        await other.onModuleDestroy();
      }
    });
  });

  describe("the connection", () => {
    it("should listen again after the server drops it", async () => {
      const gaps = jest.fn();
      subscriptions.push(feed.gaps.subscribe(gaps));
      const events = await listen({operations: ["insert"]});

      await pool.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query = 'LISTEN spica_change' AND pid <> pg_backend_pid()"
      );
      for (let waited = 0; waited < 10_000 && !gaps.mock.calls.length; waited += 50) {
        await sleep(50);
      }
      await insert({title: "after"});
      await eventually(events, 1);

      expect(gaps).toHaveBeenCalled();
      expect(events.map(event => event.document?.title)).toEqual(["after"]);
    }, 30_000);
  });

  describe("collections without a source yet", () => {
    it("should never emit", async () => {
      const events: ChangeEvent[] = [];
      subscriptions.push(feed.watch("function_assets").subscribe(event => events.push(event)));
      await insert({title: "other"});
      await sleep(SETTLE_MS);

      expect(events).toEqual([]);
    });
  });
});
