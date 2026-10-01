import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {execFileSync} from "child_process";
import {Pool} from "pg";
import {Bucket} from "@spica-server/interface-bucket";
import {
  bucketToTable,
  compileCreateSchemas,
  runIdempotentDdl,
  compileCreateTable,
  postgresCapabilities,
  PostgresDatabase,
  PostgresSchemaManager,
  SYSTEM_SCHEMA,
  TtlSweeper,
  waitForPostgres
} from "@spica-server/database-postgres";
import {
  ContractHarness,
  describeCollectionContract,
  describeIndexManagerContract,
  IndexHarness
} from "@spica-server/database-contract-test";

/**
 * **The SAME contract suite, against the PostgreSQL driver** (Phase 4's done criterion).
 *
 * The only difference from `mongo.spec.ts` is the harness; `describeCollectionContract` and
 * `describeIndexManagerContract` are unchanged. K-2's sentence "this is where the two backends are
 * proven to behave alike, not the individual module tests" only holds once this file is green.
 */
const IMAGE = "postgres:16";
const NAME = "spica-contract-pg";
const PORT = 45433;

/**
 * When `POSTGRES_URL` is given no container is started and an existing server is used instead — the
 * PG counterpart of `MONGODB_URL`. In CI the server provided by the `services:` block removes the
 * container readiness race (the reason the tests broke on the first runs) entirely.
 */
const EXTERNAL_URL = process.env.POSTGRES_URL;

let pool: Pool;
let database: PostgresDatabase;

/** The document shape the suite uses: `{_id, title, views, tags}`. */
function schemaFor(collection: string): Bucket {
  return {
    _id: collection.replace(/^bucket_/, "") as any,
    title: "Contract",
    description: "",
    primary: "title",
    acl: {read: "true==true", write: "true==true"},
    properties: {
      title: {type: "string"},
      views: {type: "number"},
      tags: {type: "array", items: {type: "string"}}
    }
  } as unknown as Bucket;
}

beforeAll(async () => {
  if (EXTERNAL_URL) {
    pool = new Pool({connectionString: EXTERNAL_URL});
    await bootstrap();
    return;
  }

  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
  execFileSync("docker", [
    "run",
    "-d",
    "--name",
    NAME,
    "-p",
    `${PORT}:5432`,
    "-e",
    "POSTGRES_PASSWORD=contract",
    IMAGE
  ]);

  const config = {
    host: "127.0.0.1",
    port: PORT,
    user: "postgres",
    password: "contract",
    database: "postgres"
  };

  /**
   * A single successful `SELECT 1` is not enough: the `postgres` image brings up a temporary server
   * for `initdb` and shuts it down again, the first success can hit that one, and the connection is
   * reset right afterwards. `waitForPostgres` requires consecutive successes.
   */
  await waitForPostgres(config);

  pool = new Pool(config);
  await bootstrap();
}, 120_000);

async function bootstrap() {
  for (const statement of compileCreateSchemas()) await runIdempotentDdl(pool, statement.sql);
  /**
   * A synchronous resolver: the counterpart of the in-memory `schemaCache` that `BucketService` feeds
   * from a change stream in production. `collection()` is synchronous, so the resolution has to be
   * synchronous too; the suite exercises that path and thereby verifies it.
   */
  database = new PostgresDatabase(pool, "contract", {
    resolveSchema: name => (knownSchemas.has(name) ? schemaFor(name) : undefined)
  });
}

/** `prepare()` writes here while creating the table; the synchronous resolver reads from here. */
const knownSchemas = new Set<string>();

afterAll(async () => {
  /**
   * The driver is closed BEFORE the pool: the CDC polling round and the TTL sweep run in the
   * background and, if they issue a query after the container is gone, produce
   * `57P01 terminating connection` — which showed up as "every test passed but the suite failed".
   */
  await database?.close().catch(() => {});
  await pool?.end().catch(() => {});
  if (EXTERNAL_URL) return;
  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
}, 60_000);

async function prepare(collection: string, entryLimit?: number) {
  const schema = schemaFor(collection);
  const table = {...bucketToTable(schema), collection};
  for (const statement of compileCreateTable(table)) {
    await runIdempotentDdl(pool, statement.sql, statement.params);
  }
  knownSchemas.add(collection);
  return {table, schema, entryLimit};
}

async function createPostgresHarness(): Promise<ContractHarness> {
  return {
    name: "postgres",
    capabilities: postgresCapabilities,
    async open(name, options) {
      const {table, schema} = await prepare(name);
      const collection = await database.openCollection(name, table, schema, options);
      await collection.deleteMany({});

      /**
       * The suite switches to a sibling collection with `collection("contract_sibling")`. The table
       * has to exist (the DDL is here), but the collection object now comes from the synchronous
       * resolver — there is no need to register it up front with `openCollection`.
       */
      await prepare("contract_sibling");

      return collection as any;
    },
    async teardown() {}
  };
}

describeCollectionContract(createPostgresHarness);

async function createPostgresIndexHarness(): Promise<IndexHarness> {
  return {
    name: "postgres",
    async open(collection) {
      const {table, schema} = await prepare(collection);
      const coll = await database.openCollection(collection, table, schema);
      return {
        manager: database.indexes(collection),
        // On PG the table comes from the schema manager; no row is needed for the precondition, but
        // the same interface is kept for symmetry with the Mongo harness.
        seed: async () => {
          await coll.insertOne({title: "seed"} as any);
        }
      };
    },
    async teardown() {}
  };
}

describeIndexManagerContract(createPostgresIndexHarness);

/** Verifies that the capability declaration actually holds (K-10). */
describe("the postgres capability declaration", () => {
  /**
   * Not `false`: the refusal AK-6 described was never implemented, and a real instance answers the
   * measured closed set correctly while rejecting anything outside it by name. A half-true flag is more
   * dangerous than a wrong one — the panel reads this and decides whether to offer the surface at all.
   */
  it("declares raw Mongo JSON filters as a subset on the user surface (AK-6)", () => {
    expect(postgresCapabilities.rawMongoFilter).toBe("subset");
  });

  it("no native TTL, the sweeper is in charge", () => {
    expect(postgresCapabilities.nativeTTLIndex).toBe(false);
  });

  it("has real FK integrity — Mongo does not", () => {
    expect(postgresCapabilities.referentialIntegrity).toBe(true);
  });

  it("no replica set is required", () => {
    expect(postgresCapabilities.requiresReplicaSet).toBe(false);
  });

  it("declares the column slot limit (K-7)", () => {
    expect(postgresCapabilities.maxLifetimeFieldsPerCollection).toBe(1600);
  });

  /**
   * The devkit that gives functions a direct connection (K-11). It read `false` for a while **after**
   * `@spica-devkit/postgres` shipped, which is the same defect as an over-reported capability: the panel
   * reads the declaration and hides the interface, so under-reporting loses a feature silently.
   */
  it("names the devkit that gives functions direct access (K-11)", () => {
    expect(postgresCapabilities.directAccessDevkit).toBe("@spica-devkit/postgres");
  });
});

/**
 * An index on an array column, created against **real** PostgreSQL.
 *
 * The unit test only checked that `USING gin` appeared in the string, so the `ASC` next to it went
 * unnoticed and the server rejected the statement at runtime. `FunctionService.afterInit` asks for
 * exactly this shape (`createIndex({env_vars: 1})` on a relation array) and logs its failure instead of
 * throwing, so two production indexes were simply missing and every test stayed green. Only a real
 * `CREATE INDEX` catches that.
 */
describe("an index on an array column", () => {
  const collection = "bucket_arrayidx";

  it("is created with GIN and no ordering option", async () => {
    const {table, schema} = await prepare(collection);
    await database.openCollection(collection, table, schema);

    await database.indexes(collection).create({keys: [{field: "tags", direction: 1}]});

    // The table creation already puts a GIN index on the array column, so there is more than one here;
    // what matters is that every one of them was accepted, which `CREATE INDEX` only does without ASC/DESC.
    const {rows} = await pool.query<{indexdef: string}>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = $1 AND indexdef LIKE '%USING gin%'`,
      [collection]
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach(row => {
      expect(row.indexdef).toContain("USING gin");
      expect(row.indexdef).not.toMatch(/\b(ASC|DESC)\b/);
    });
  });

  it("is reported by the index manager", async () => {
    const listed = await database.indexes(collection).list();
    expect(listed.map(index => index.keys)).toContainEqual([{field: "tags", direction: 1}]);
  });
});

/**
 * The DDL planner and the drift check against real PostgreSQL (K-7, K-12).
 *
 * The same behaviours were measured on the prototype in step S (1–2 ms at 10,000 rows,
 * `lock_timeout` → 55P03, drift 0); here the driver's implementation is verified.
 */
describe("PostgresSchemaManager — real database", () => {
  let manager: PostgresSchemaManager;

  beforeAll(async () => {
    manager = new PostgresSchemaManager(pool, {
      transaction: work => database.transaction(work as any) as any
    });
    await manager.bootstrap();
  }, 60_000);

  const spec = (collection: string, columns: any[]) => ({collection, columns});

  it("ensure creates the table and the implicit _id primary key", async () => {
    const table = spec("ddl_ensure", [{name: "title", kind: "text"}]);
    await manager.ensure(table);
    const drift = await manager.verify(table);
    expect(drift.missingColumns).toEqual([]);
    expect(drift.unexpectedColumns).toEqual([]);
  });

  it("apply runs the ADD COLUMN and records it", async () => {
    const before = spec("ddl_add", [{name: "title", kind: "text"}]);
    await manager.ensure(before);

    const after = spec("ddl_add", [
      {name: "title", kind: "text"},
      {name: "views", kind: "number"}
    ]);
    await manager.apply(await manager.plan(before, after));

    expect((await manager.verify(after)).missingColumns).toEqual([]);

    const {rows} = await pool.query(
      `SELECT count(*)::int AS n FROM spica."bucket_schema_changes" WHERE bucket_id = $1`,
      ["ddl_add"]
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });

  it("RENAME COLUMN PRESERVES the data (K-7 safety rule)", async () => {
    const before = spec("ddl_rename", [{name: "title", kind: "text"}]);
    await manager.ensure(before);
    await pool.query(`INSERT INTO bucket."ddl_rename" ("_id", "title") VALUES ($1, $2)`, [
      "a".repeat(24),
      "preserved"
    ]);

    const after = spec("ddl_rename", [{name: "heading", kind: "text"}]);
    await manager.apply(
      await manager.plan(before, after, {renames: [{from: "title", to: "heading"}]})
    );

    const {rows} = await pool.query(`SELECT "heading" FROM bucket."ddl_rename"`);
    expect(rows[0].heading).toBe("preserved");
  });

  it("DROP COLUMN is a catalog operation — the row count does not change", async () => {
    const before = spec("ddl_drop", [
      {name: "title", kind: "text"},
      {name: "dropped", kind: "text"}
    ]);
    await manager.ensure(before);
    await pool.query(`INSERT INTO bucket."ddl_drop" ("_id", "title") VALUES ($1, $2)`, [
      "b".repeat(24),
      "kept"
    ]);

    const after = spec("ddl_drop", [{name: "title", kind: "text"}]);
    await manager.apply(await manager.plan(before, after));

    const {rows} = await pool.query(`SELECT "title" FROM bucket."ddl_drop"`);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("kept");
    expect((await manager.verify(after)).unexpectedColumns).toEqual([]);
  });

  /**
   * The `reltuples` read of the long-running decision (AK-5 / D7), against a real catalog. The unit tests
   * use a fake, so this is the only place the SQL itself is exercised — and `ANALYZE` matters: `reltuples`
   * is `-1` on a table that has never been analyzed.
   */
  it("plan reports the estimated row count for a rewriting type change", async () => {
    const before = spec("ddl_estimate", [{name: "views", kind: "text"}]);
    await manager.ensure(before);
    await pool.query(
      `INSERT INTO bucket."ddl_estimate" (_id, views)
       SELECT lpad(to_hex(g), 24, '0'), g::text FROM generate_series(1, 200) g`
    );
    await pool.query(`ANALYZE bucket."ddl_estimate"`);

    const after = spec("ddl_estimate", [{name: "views", kind: "number"}]);
    const plan = await manager.plan(before, after);

    expect(plan.requiresRewrite).toBe(true);
    expect(plan.estimatedRows).toBe(200);
    // 200 rows is far below the 100k threshold: a rewrite, but not one worth a warning.
    expect(plan.longRunning).toBe(false);
  });

  /**
   * The path production takes (`clearOnTypeChange`) is a catalog operation: no rewrite, no warning, and
   * — verified here — the values really are gone afterwards.
   */
  it("clearOnTypeChange is a catalog operation and clears the values", async () => {
    const before = spec("ddl_clear", [{name: "views", kind: "text"}]);
    await manager.ensure(before);
    await pool.query(
      `INSERT INTO bucket."ddl_clear" (_id, views)
       SELECT lpad(to_hex(g), 24, '0'), g::text FROM generate_series(1, 50) g`
    );

    const after = spec("ddl_clear", [{name: "views", kind: "number"}]);
    const plan = await manager.plan(before, after, {clearOnTypeChange: true});
    expect(plan.requiresRewrite).toBe(false);
    expect(plan.longRunning).toBe(false);

    await manager.apply(plan);

    const {rows} = await pool.query(
      `SELECT count(*)::int AS total, count("views")::int AS kept FROM bucket."ddl_clear"`
    );
    expect(rows[0]).toEqual({total: 50, kept: 0});
    expect((await manager.verify(after)).missingColumns).toEqual([]);
  });

  it("verify reports a manually added column as DRIFT (K-12)", async () => {
    const table = spec("ddl_drift", [{name: "title", kind: "text"}]);
    await manager.ensure(table);
    // DDL made by hand, outside the intent — exactly what K-12 is there to catch.
    await pool.query(`ALTER TABLE bucket."ddl_drift" ADD COLUMN "elle" text`);

    const drift = await manager.verify(table);
    expect(drift.unexpectedColumns).toEqual(["elle"]);
    expect(drift.missingColumns).toEqual([]);
  });

  it("verify reports the missing column", async () => {
    const table = spec("ddl_missing", [{name: "title", kind: "text"}]);
    await manager.ensure(table);
    await pool.query(`ALTER TABLE bucket."ddl_missing" DROP COLUMN "title"`);

    const drift = await manager.verify(table);
    expect(drift.missingColumns).toEqual(["title"]);
  });

  it("verify reports a type mismatch", async () => {
    const table = spec("ddl_type", [{name: "views", kind: "number"}]);
    await manager.ensure(table);
    await pool.query(`ALTER TABLE bucket."ddl_type" ALTER COLUMN "views" TYPE text`);

    const drift = await manager.verify(table);
    expect(drift.typeMismatches).toHaveLength(1);
    expect(drift.typeMismatches[0]).toMatchObject({column: "views", expected: "number"});
  });

  it("apply is atomic: if one statement fails, none of them are applied", async () => {
    const table = spec("ddl_atomic", [{name: "title", kind: "text"}]);
    await manager.ensure(table);

    const plan = {
      collection: "ddl_atomic",
      changes: [],
      requiresRewrite: false,
      longRunning: false,
      statements: [
        `ALTER TABLE bucket."ddl_atomic" ADD COLUMN "good" text`,
        `ALTER TABLE bucket."ddl_atomic" ADD COLUMN "bad" unknown_type`
      ]
    };

    await expect(manager.apply(plan)).rejects.toThrow();
    const drift = await manager.verify(spec("ddl_atomic", [{name: "title", kind: "text"}]));
    // The first statement was rolled back too: a single transaction.
    expect(drift.unexpectedColumns).toEqual([]);
  });
});

/**
 * ReadPlan execution against real PostgreSQL (the Phase 3b compiler plus the Phase 4 driver).
 *
 * The counterpart of the Mongo behaviour measured in §5.1: i18n via `COALESCE`, relations via
 * `LATERAL`, pagination via two **parallel** queries (R17).
 */
describe("read(plan) — real database", () => {
  const POSTS = "rp_posts";
  const AUTHORS = "rp_authors";

  const authorSchema = {
    _id: "67b3" as any,
    title: "Authors",
    description: "",
    primary: "name",
    acl: {read: "true==true", write: "true==true"},
    properties: {name: {type: "string"}}
  } as any;

  const postSchema = {
    _id: "67a1" as any,
    title: "Posts",
    description: "",
    primary: "slug",
    acl: {read: "true==true", write: "true==true"},
    properties: {
      title: {type: "string", options: {translate: true}},
      slug: {type: "string"},
      views: {type: "number"},
      published: {type: "boolean"},
      author: {type: "relation", relationType: "onetoone", bucketId: "67b3"}
    }
  } as any;

  let posts: any;
  let authorIds: string[] = [];

  beforeAll(async () => {
    const authorTable = {...bucketToTable(authorSchema), collection: AUTHORS};
    const postTable = {...bucketToTable(postSchema), collection: POSTS};
    // The target table first: the FK constraint references it.
    for (const statement of compileCreateTable(authorTable)) {
      await runIdempotentDdl(pool, statement.sql, statement.params);
    }
    for (const statement of compileCreateTable({
      ...postTable,
      columns: postTable.columns.map(c => (c.name === "author" ? {...c, target: AUTHORS} : c))
    })) {
      await pool.query(statement.sql, statement.params);
    }

    const authors = await database.openCollection(AUTHORS, authorTable, authorSchema);
    await authors.deleteMany({});
    for (const name of ["Ali", "Veli"]) {
      const inserted = await authors.insertOne({name} as any);
      authorIds.push((inserted as any)._id.toHexString());
    }

    posts = await database.openCollection(
      POSTS,
      {
        ...postTable,
        columns: postTable.columns.map(c => (c.name === "author" ? {...c, target: AUTHORS} : c))
      },
      postSchema
    );
    posts.relationTargets = {[AUTHORS]: authorTable};
    await posts.deleteMany({});

    for (let i = 0; i < 6; i++) {
      await posts.insertOne({
        title: {tr_TR: `Post TR ${i}`, en_US: `Post EN ${i}`},
        slug: `post-${i}`,
        views: i * 100,
        published: i % 2 === 0,
        author: authorIds[i % 2]
      } as any);
    }
  }, 60_000);

  const plan = (overrides: any = {}) => ({collection: POSTS, ...overrides});

  it("a read without a filter returns every row", async () => {
    const result = await posts.read(plan());
    expect(result.data).toHaveLength(6);
    expect(result.total).toBeUndefined();
  });

  it("i18n is resolved with COALESCE", async () => {
    const result = await posts.read(
      plan({
        localize: {locale: "tr_TR", fallback: "en_US", properties: ["title"], stage: "projection"}
      })
    );
    expect(result.data[0].title).toMatch(/^Post TR /);
  });

  it("returns the raw language map when localization is not requested", async () => {
    const result = await posts.read(plan());
    expect(typeof result.data[0].title).toBe("object");
    expect(result.data[0].title.tr_TR).toBeDefined();
  });

  it("a CEL filter is compiled into WHERE and applied", async () => {
    const result = await posts.read(
      plan({
        filter: {
          kind: "binary",
          operator: ">",
          left: {
            kind: "select",
            left: {kind: "identifier", name: "document"},
            right: {kind: "identifier", name: "views"}
          },
          right: {kind: "literal", type: "double", value: 200}
        }
      })
    );
    expect(result.data.every((d: any) => d.views > 200)).toBe(true);
    expect(result.data).toHaveLength(3);
  });

  it("ACL and filter are applied together", async () => {
    const acl = {
      kind: "binary",
      operator: "==",
      left: {
        kind: "select",
        left: {kind: "identifier", name: "document"},
        right: {kind: "identifier", name: "published"}
      },
      right: {kind: "literal", type: "bool", value: true}
    };
    const result = await posts.read(plan({acl}));
    expect(result.data.every((d: any) => d.published === true)).toBe(true);
  });

  it("sort, limit and skip", async () => {
    const result = await posts.read(plan({sort: {views: -1}, limit: 2, skip: 1}));
    expect(result.data).toHaveLength(2);
    expect(result.data[0].views).toBe(400);
  });

  it("a relation is resolved with LATERAL (stage: projection)", async () => {
    const result = await posts.read(
      plan({
        relations: [{path: "author", target: AUTHORS, type: "one", stage: "projection"}],
        limit: 2
      })
    );
    expect(result.data).toHaveLength(2);
    expect(result.data[0].author).toBeTruthy();
    expect(["Ali", "Veli"]).toContain(result.data[0].author.name);
  });

  it("pagination returns the total count with two PARALLEL queries (R17)", async () => {
    const result = await posts.read(plan({paginate: true, limit: 2}));
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(6);
  });

  it("projection drops the columns that were not requested", async () => {
    const result = await posts.read(plan({projection: {include: ["slug"]}, limit: 1}));
    expect(result.data[0].slug).toBeDefined();
    expect(result.data[0].views).toBeUndefined();
  });

  it("field level ACL (denied) drops the column", async () => {
    const result = await posts.read(plan({projection: {denied: ["views"]}, limit: 1}));
    expect(result.data[0].views).toBeUndefined();
    expect(result.data[0].slug).toBeDefined();
  });
});

/**
 * The TTL sweeper (Phase 4).
 *
 * In MongoDB `expireAfterSeconds` is an index property and the server does the deleting; PostgreSQL
 * has no native counterpart. `upsertTTLIndex` raising on PG is deliberate — a declared absence of a
 * capability must not silently look successful — and this sweeper takes the deleting over.
 */
describe("TtlSweeper", () => {
  const TABLE = "ttl_probe";

  beforeAll(async () => {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${SYSTEM_SCHEMA}."${TABLE}" (
         "_id" char(24) PRIMARY KEY,
         "created_at" timestamptz NOT NULL
       )`
    );
  }, 30_000);

  const seed = async (rows: {id: string; ageSeconds: number}[]) => {
    await pool.query(`TRUNCATE ${SYSTEM_SCHEMA}."${TABLE}"`);
    for (const row of rows) {
      await pool.query(
        `INSERT INTO ${SYSTEM_SCHEMA}."${TABLE}" ("_id", "created_at")
         VALUES ($1, now() - ($2 || ' seconds')::interval)`,
        [row.id, String(row.ageSeconds)]
      );
    }
  };

  const remaining = async () => {
    const {rows} = await pool.query<{count: string}>(
      `SELECT count(*)::text AS count FROM ${SYSTEM_SCHEMA}."${TABLE}"`
    );
    return Number(rows[0].count);
  };

  const sweeper = () => new TtlSweeper(pool, {schema: SYSTEM_SCHEMA, batchSize: 2});

  it("deletes the expired rows and leaves the others untouched", async () => {
    await seed([
      {id: "a".repeat(24), ageSeconds: 300},
      {id: "b".repeat(24), ageSeconds: 10}
    ]);

    const instance = sweeper();
    instance.register({table: TABLE, field: "created_at", seconds: 60});

    expect(await instance.sweep()).toBe(1);
    expect(await remaining()).toBe(1);
  });

  it("deletes nothing when there is no registration", async () => {
    await seed([{id: "c".repeat(24), ageSeconds: 9999}]);
    expect(await sweeper().sweep()).toBe(0);
    expect(await remaining()).toBe(1);
  });

  it("clears a backlog larger than batchSize in chunks", async () => {
    await seed(
      Array.from({length: 5}, (_, i) => ({
        id: String(i).padStart(24, "d"),
        ageSeconds: 300
      }))
    );

    const instance = sweeper();
    instance.register({table: TABLE, field: "created_at", seconds: 60});

    // batchSize: 2 → the loop inside a single sweep() has to finish all 5 rows.
    expect(await instance.sweep()).toBe(5);
    expect(await remaining()).toBe(0);
  });

  it("does not sweep after unregister", async () => {
    await seed([{id: "e".repeat(24), ageSeconds: 300}]);

    const instance = sweeper();
    instance.register({table: TABLE, field: "created_at", seconds: 60});
    instance.unregister(TABLE, "created_at");

    expect(await instance.sweep()).toBe(0);
    expect(await remaining()).toBe(1);
  });

  it("start/stop manages the timer without leaking it", async () => {
    const instance = sweeper();
    instance.start();
    instance.start();
    instance.stop();
    instance.stop();
    expect(await instance.sweep()).toBe(0);
  });
});
