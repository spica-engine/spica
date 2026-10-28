import {createPostgresDatabase} from "@spica-server/database-testing";
import pg from "pg";
import {defineEntity} from "../src/entity.js";
import {createTables, TABLES_LOCK_NAME} from "../src/tables.js";

const gadgets = defineEntity({
  table: "gadgets",
  columns: {
    name: {type: "text", notNull: true},
    labels: {type: "text[]"}
  },
  indexes: [
    {columns: ["name"], unique: true},
    {columns: ["labels"], using: "gin"}
  ]
});

const gizmos = defineEntity({
  table: "gizmos",
  columns: {gadgetId: {type: "uuid"}},
  indexes: [{columns: ["gadgetId"]}]
});

describe("createTables", () => {
  let uri: string;
  const pools: pg.Pool[] = [];

  const newPool = (max = 5) => {
    const pool = new pg.Pool({connectionString: uri, max});
    pools.push(pool);
    return pool;
  };

  beforeEach(async () => {
    uri = await createPostgresDatabase();
  });

  afterEach(async () => {
    await Promise.all(pools.splice(0).map(pool => pool.end()));
  });

  it("creates tables and indexes", async () => {
    const pool = newPool();
    await createTables(pool, [gadgets, gizmos]);

    const {rows: tables} = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    expect(tables.map(row => row.tablename)).toEqual(["gadgets", "gizmos"]);

    const {rows: indexes} = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname"
    );
    expect(indexes.map(row => row.indexname)).toEqual([
      "gadgets_labels_idx",
      "gadgets_name_key",
      "gadgets_pkey",
      "gizmos_gadget_id_idx",
      "gizmos_pkey"
    ]);
  });

  it("is idempotent and keeps existing data", async () => {
    const pool = newPool();
    await createTables(pool, [gadgets]);
    await pool.query("INSERT INTO gadgets (name) VALUES ('keep')");

    await createTables(pool, [gadgets]);

    const {rows} = await pool.query("SELECT name FROM gadgets");
    expect(rows).toEqual([{name: "keep"}]);
  });

  it("leaves a table that already has its final shape untouched", async () => {
    const pool = newPool();
    await pool.query(
      "CREATE TABLE gadgets (id uuid PRIMARY KEY DEFAULT uuidv7(), name text NOT NULL, labels text[], extra int)"
    );

    await createTables(pool, [gadgets]);

    const {rows} = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'gadgets' ORDER BY ordinal_position"
    );
    expect(rows.map(row => row.column_name)).toEqual(["id", "name", "labels", "extra"]);
  });

  it("waits for a session that holds the advisory lock", async () => {
    const holder = newPool(1);
    const client = await holder.connect();
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [TABLES_LOCK_NAME]);

    const pool = newPool();
    let finished = false;
    const creating = createTables(pool, [gadgets]).then(() => (finished = true));

    await new Promise(resolve => setTimeout(resolve, 300));
    expect(finished).toBe(false);

    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [TABLES_LOCK_NAME]);
    client.release();
    await creating;
    expect(finished).toBe(true);
  });

  it("releases the lock when creation fails", async () => {
    const pool = newPool();
    const broken = defineEntity({
      table: "broken",
      columns: {value: {type: "integer", default: "not a valid default ((("}}
    });

    await expect(createTables(pool, [broken])).rejects.toThrow();
    await expect(createTables(pool, [gadgets])).resolves.toBeUndefined();
  });

  it("destroys the connection when unlocking fails", async () => {
    const release = jest.fn();
    const client = {
      query: jest.fn(async (text: string) => {
        if (text.includes("pg_advisory_unlock")) {
          throw new Error("connection lost");
        }
        return {rows: []};
      }),
      release
    };
    const pool = {connect: async () => client} as unknown as pg.Pool;

    await expect(createTables(pool, [gadgets])).rejects.toThrow("connection lost");
    expect(release).toHaveBeenCalledWith(true);
  });

  it("keeps the connection when unlocking succeeds", async () => {
    const release = jest.fn();
    const client = {query: jest.fn(async () => ({rows: []})), release};
    const pool = {connect: async () => client} as unknown as pg.Pool;

    await createTables(pool, [gadgets]);
    expect(release).toHaveBeenCalledWith(false);
  });
});
