import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {execFileSync} from "child_process";
import {Client, Pool} from "pg";
import {Bucket} from "@spica-server/interface-bucket";
import {
  bucketToTable,
  compileCreateSchemas,
  runIdempotentDdl,
  compileCreateTable,
  compileReadPlan,
  PostgresDatabase,
  waitForPostgres
} from "@spica-server/database-postgres";

/**
 * The performance budget, measured against the **real driver** and asserted as a
 * regression guard.
 *
 * The first measurements came from a prototype with hand-written SQL, before the driver existed. This file
 * measures the same shapes through `PostgresCollection.read()`, that is, through `compileReadPlan`, the
 * codec and the pool — the code that actually ships.
 *
 * **Two kinds of assertion, and the structural ones matter more.** A query count is deterministic: "one
 * round trip", "no N+1", "pagination is two parallel queries" either hold or they do not, on any machine.
 * The timing assertions use the performance budget, which leaves roughly two orders of magnitude of headroom on
 * PostgreSQL — they are there to catch a structural regression (an i18n stage moving in front of the
 * filter, a relation turning into N+1), not to measure the machine. A benchmark that fails on a loaded CI
 * runner would be removed within a week, and then it would guard nothing.
 */
const IMAGE = "postgres:16";
const NAME = "spica-budget-pg";
const PORT = 45435;
const EXTERNAL_URL = process.env.POSTGRES_URL;

const POSTS = Number(process.env.BUDGET_POSTS ?? 10_000);
const AUTHORS = 500;
const ITER = Number(process.env.BUDGET_ITER ?? 50);
/**
 * The warmup is generous on purpose: the first shape measured otherwise pays the JIT cost of the whole
 * read path and reports a p95 several times its own p50 (5.4 ms against a 0.7 ms median, measured).
 * That is a property of the first measurement, not of the shape.
 */
const WARMUP = 30;

/**
 * The budget rows. The list p95 is the Mongo baseline of the realistic full stack (S7: 28.57 ms)
 * plus the 20% the budget allows.
 */
const BUDGET = {
  listP95Ms: 34.3,
  compileMs: 1,
  realtimeP95Ms: 50
};

const POST_TABLE = "bm_posts";
const AUTHOR_TABLE = "bm_authors";

const authorSchema = {
  _id: "67b3" as any,
  title: "Authors",
  description: "",
  primary: "name",
  acl: {read: "true==true", write: "true==true"},
  properties: {name: {type: "string"}}
} as unknown as Bucket;

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
    author: {type: "relation", relationType: "onetoone", bucketId: "67b3"},
    tags: {type: "array", items: {type: "string"}}
  }
} as unknown as Bucket;

let pool: Pool;
let listenClient: Client;
let database: PostgresDatabase;
let posts: any;

/** Counts the queries the driver issues, so "one round trip" can be asserted rather than assumed. */
let queries = 0;
const counted = <T>(work: () => Promise<T>): Promise<[T, number]> => {
  const before = queries;
  return work().then(result => [result, queries - before]);
};

const authorTable = () => ({...bucketToTable(authorSchema), collection: AUTHOR_TABLE});
const postTable = () => {
  const table = bucketToTable(postSchema);
  return {
    ...table,
    collection: POST_TABLE,
    columns: table.columns.map(c => (c.name === "author" ? {...c, target: AUTHOR_TABLE} : c))
  };
};

beforeAll(async () => {
  if (EXTERNAL_URL) {
    pool = new Pool({connectionString: EXTERNAL_URL});
  } else {
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
      "POSTGRES_PASSWORD=budget",
      IMAGE
    ]);
    const config = {
      host: "127.0.0.1",
      port: PORT,
      user: "postgres",
      password: "budget",
      database: "postgres"
    };
    await waitForPostgres(config);
    pool = new Pool(config);
  }

  const query = pool.query.bind(pool);
  (pool as any).query = (...args: any[]) => {
    queries++;
    return (query as any)(...args);
  };

  for (const statement of compileCreateSchemas()) await runIdempotentDdl(pool, statement.sql);
  for (const statement of compileCreateTable(authorTable())) {
    await runIdempotentDdl(pool, statement.sql, statement.params);
  }
  for (const statement of compileCreateTable(postTable())) {
    await runIdempotentDdl(pool, statement.sql, statement.params);
  }

  /**
   * Seeded with SQL rather than through `insertOne`: the subject here is the **read** path, and
   * `insertMany` issues one statement per document today, which would put minutes into the setup.
   * The rows are written in the codec's storage format, so what the driver reads back is what it would
   * have written.
   */
  await pool.query(
    `INSERT INTO bucket."${AUTHOR_TABLE}" (_id, name)
     SELECT lpad(to_hex(g), 24, '0'), 'Author ' || g
     FROM generate_series(1, $1) g`,
    [AUTHORS]
  );
  await pool.query(
    `INSERT INTO bucket."${POST_TABLE}" (_id, title, slug, views, published, author, tags)
     SELECT lpad(to_hex(1000000 + g), 24, '0'),
            jsonb_build_object('tr_TR', 'Yazi ' || g, 'en_US', 'Post ' || g),
            'post-' || g,
            (g % 1000)::double precision,
            g % 3 = 0,
            lpad(to_hex(1 + (g % $2)), 24, '0'),
            ARRAY['t' || (g % 7), 't' || (g % 13)]
     FROM generate_series(1, $1) g`,
    [POSTS, AUTHORS]
  );
  await pool.query(`ANALYZE bucket."${POST_TABLE}"`);
  await pool.query(`ANALYZE bucket."${AUTHOR_TABLE}"`);

  /**
   * A dedicated `LISTEN` connection, because the realtime row measures **commit → event** and without it
   * the change stream falls back to polling. Polling is correct but its latency is the poll interval, so
   * measuring the budget without a notifier would report the interval rather than the driver.
   */
  listenClient = new Client(
    EXTERNAL_URL
      ? {connectionString: EXTERNAL_URL}
      : {host: "127.0.0.1", port: PORT, user: "postgres", password: "budget", database: "postgres"}
  );
  await listenClient.connect();

  database = new PostgresDatabase(pool, "budget", {
    resolveSchema: name =>
      name === POST_TABLE ? postSchema : name === AUTHOR_TABLE ? authorSchema : undefined,
    changeStream: {listenClient}
  });
  posts = await database.openCollection(POST_TABLE, postTable(), postSchema);

  /**
   * The CDC outbox and the trigger functions come from `bootstrap()`; `openCollection` only prepares the
   * table. The realtime and amplification rows need both, and `bootstrap()` is idempotent, so calling it
   * after the tables exist is safe.
   */
  await database.bootstrap();
  await database.ensureTriggers(POST_TABLE, "bucket");

  /**
   * `bootstrap()` registers `LISTEN` itself now, so nothing extra is needed here — and that is what
   * this spec is measuring: without the registration the realtime number is the poll interval (351 ms p95,
   * i.e. 500 ms minus the pre-insert wait), not a latency. The trap was found exactly this way.
   */
}, 300_000);

afterAll(async () => {
  await database?.close().catch(() => {});
  await listenClient?.end().catch(() => {});
  await pool?.end().catch(() => {});
  if (EXTERNAL_URL) return;
  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
}, 60_000);

const doc = (...path: string[]): any =>
  path.reduce<any>((left, name) => ({kind: "select", left, right: {kind: "identifier", name}}), {
    kind: "identifier",
    name: "document"
  });
const gt = (left: any, value: number): any => ({
  kind: "binary",
  operator: ">",
  left,
  right: {kind: "literal", type: "double", value}
});

const plan = (overrides: any = {}) => ({collection: POST_TABLE, ...overrides});

const pct = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

const measured: {shape: string; p50: number; p95: number; queries: number}[] = [];

/** Runs a shape `ITER` times and records p50/p95 plus the query count of a single run. */
async function measure(shape: string, run: () => Promise<any>) {
  for (let i = 0; i < WARMUP; i++) await run();
  const [, count] = await counted(run);

  const samples: number[] = [];
  for (let i = 0; i < ITER; i++) {
    const started = process.hrtime.bigint();
    await run();
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  const row = {
    shape,
    p50: +pct(samples, 50).toFixed(2),
    p95: +pct(samples, 95).toFixed(2),
    queries: count
  };
  measured.push(row);
  return row;
}

afterAll(() => {
  if (!measured.length) return;
  const lines = measured.map(
    r =>
      `  ${r.shape.padEnd(34)} p50 ${String(r.p50).padStart(7)}  p95 ${String(r.p95).padStart(7)}  queries ${r.queries}`
  );
  console.log(
    `\nPerformance budget — PostgreSQL, real driver (${POSTS} posts + ${AUTHORS} authors, ITER=${ITER}):\n${lines.join("\n")}`
  );
});

describe("performance budget — the read path on the real driver", () => {
  it("an unfiltered list is one round trip and stays inside the budget", async () => {
    const row = await measure("List, unfiltered, limit 25", () => posts.read(plan({limit: 25})));
    expect(row.queries).toBe(1);
    expect(row.p95).toBeLessThan(BUDGET.listP95Ms);
  }, 120_000);

  it("a filtered list is one round trip", async () => {
    const row = await measure("Filter + limit", () =>
      posts.read(plan({filter: gt(doc("views"), 500), limit: 25}))
    );
    expect(row.queries).toBe(1);
    expect(row.p95).toBeLessThan(BUDGET.listP95Ms);
  }, 120_000);

  /**
   * Pagination is **two** queries and that is the measured decision: a single statement with
   * `count(*) OVER ()` has to materialize every matching row and came out 38% slower than Mongo's two
   * parallel queries. Asserting the count keeps someone from "optimizing" it back into one.
   */
  it("pagination is two parallel queries, not one statement", async () => {
    const row = await measure("Filter + sort + pagination", () =>
      posts.read(
        plan({
          filter: gt(doc("views"), 500),
          sort: {views: -1},
          skip: 100,
          limit: 25,
          paginate: true
        })
      )
    );
    expect(row.queries).toBe(2);
    expect(row.p95).toBeLessThan(BUDGET.listP95Ms);
  }, 120_000);

  /**
   * The row that broke the Mongo baseline: there the i18n stage is added in front of the filter and runs
   * over all 10,000 documents (0.37 ms → 27.27 ms). On PostgreSQL the `COALESCE` sits in the SELECT
   * list, so it runs on the returned rows only. If it ever regresses, this is where it shows.
   */
  it("i18n stays one round trip and does not run over the whole table", async () => {
    const row = await measure("i18n + filter", () =>
      posts.read(
        plan({
          filter: gt(doc("views"), 500),
          limit: 25,
          localize: {locale: "tr_TR", fallback: "en_US", properties: ["title"], stage: "projection"}
        })
      )
    );
    expect(row.queries).toBe(1);
    expect(row.p95).toBeLessThan(BUDGET.listP95Ms);
  }, 120_000);

  /** The budget: "`$lookup` → SQL: a **single** SQL statement (LATERAL join). Definitely no N+1." */
  it("a relation for display is a single statement — no N+1", async () => {
    const row = await measure("Relation for display", () =>
      posts.read(
        plan({
          limit: 25,
          relations: [{path: "author", target: AUTHOR_TABLE, type: "one", stage: "projection"}]
        })
      )
    );
    expect(row.queries).toBe(1);
    expect(row.p95).toBeLessThan(BUDGET.listP95Ms);
  }, 120_000);

  it("a relation in the filter is a single statement too", async () => {
    const row = await measure("Relation in the filter", () =>
      posts.read(
        plan({
          limit: 25,
          relations: [{path: "author", target: AUTHOR_TABLE, type: "one", stage: "filter"}],
          filter: {
            kind: "binary",
            operator: "==",
            left: doc("author", "name"),
            right: {kind: "literal", type: "string", value: "Author 7"}
          }
        })
      )
    );
    expect(row.queries).toBe(1);
    expect(row.p95).toBeLessThan(BUDGET.listP95Ms);
  }, 120_000);

  it("ACL and filter are one round trip", async () => {
    const row = await measure("ACL + filter", () =>
      posts.read(plan({acl: gt(doc("views"), 10), filter: gt(doc("views"), 500), limit: 25}))
    );
    expect(row.queries).toBe(1);
    expect(row.p95).toBeLessThan(BUDGET.listP95Ms);
  }, 120_000);

  /**
   * The realistic full stack — the shape the list budget is written against (S7: Mongo 28.57 ms
   * p95, so the budget is 34.3 ms).
   */
  it("the realistic full stack stays inside the list budget", async () => {
    const row = await measure("Realistic full stack (S7)", () =>
      posts.read(
        plan({
          acl: gt(doc("views"), 10),
          filter: gt(doc("views"), 500),
          sort: {views: -1},
          skip: 50,
          limit: 25,
          paginate: true,
          localize: {
            locale: "tr_TR",
            fallback: "en_US",
            properties: ["title"],
            stage: "projection"
          },
          relations: [{path: "author", target: AUTHOR_TABLE, type: "one", stage: "projection"}]
        })
      )
    );
    expect(row.queries).toBe(2);
    expect(row.p95).toBeLessThan(BUDGET.listP95Ms);
  }, 120_000);
});

describe("performance budget — compilation cost", () => {
  /**
   * The budget: "filter/pipeline translation cost: under 1 ms per query". `compileReadPlan` is a pure function,
   * so this is measured without a database — the number is the compiler's own cost, not a round trip.
   */
  it("compiling a read plan costs well under a millisecond", () => {
    const context = {table: postTable(), targets: {[AUTHOR_TABLE]: authorTable()}};
    const input = plan({
      acl: gt(doc("views"), 10),
      filter: gt(doc("views"), 500),
      sort: {views: -1},
      skip: 50,
      limit: 25,
      paginate: true,
      localize: {locale: "tr_TR", fallback: "en_US", properties: ["title"], stage: "projection"},
      relations: [{path: "author", target: AUTHOR_TABLE, type: "one", stage: "projection"}]
    });

    for (let i = 0; i < 200; i++) compileReadPlan(input as any, context as any);

    const samples: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const started = process.hrtime.bigint();
      compileReadPlan(input as any, context as any);
      samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    }
    const p95 = +pct(samples, 95).toFixed(4);
    measured.push({
      shape: "compileReadPlan (compile only)",
      p50: +pct(samples, 50).toFixed(4),
      p95,
      queries: 0
    });
    expect(p95).toBeLessThan(BUDGET.compileMs);
  });
});

describe("performance budget — connection pool", () => {
  /**
   * The budget: "a fixed pool, no connection opened per query". The pool's own counter is the evidence: after a
   * burst of queries the number of connections must not have grown with the number of queries.
   */
  it("does not open a connection per query", async () => {
    const before = pool.totalCount;
    for (let i = 0; i < 40; i++) await posts.read(plan({limit: 5}));
    expect(pool.totalCount).toBeLessThanOrEqual(Math.max(before, 1) + 1);
  }, 120_000);
});

describe("performance budget — realtime and CDC", () => {
  /**
   * The registration is part of `bootstrap()`. Stated explicitly because the realtime number below is
   * meaningless without it: a driver that never registered `LISTEN` still answers, just on the 500 ms poll,
   * and the measurement then reports the interval instead of a latency. That is how the trap was found.
   */
  it("registers LISTEN during bootstrap, without the caller asking", () => {
    expect((database.changeStream() as unknown as {listening: boolean}).listening).toBe(true);
  });

  /**
   * The budget: "realtime change latency (commit → socket): under 50 ms p95; the measured Mongo baseline is
   * 3.67 ms". Measured here as commit → the event reaching a `watch()` subscriber, which is the driver's
   * half of that path; the websocket hop above it is backend-independent.
   *
   * The subscription is established **before** the write and the first event is awaited, because
   * `Observable.subscribe` is synchronous while the setup is a round trip — the same race `probeWatch`
   * exists for.
   *
   * `onReady` is what the write waits for. It used to be a flat 150 ms, and that was enough until
   * the triggers started being attached on the first subscription: the first round's DDL does not
   * fit in 150 ms, the write then landed before the watermark was pinned, and the event only arrived on
   * the next poll round — a p95 of 353.97 ms against a p50 of 5.6 ms. The sleep was measuring the setup,
   * not the latency.
   */
  it("commit → event stays well inside the realtime budget", async () => {
    const collection = database.collection(POST_TABLE);
    const samples: number[] = [];
    const ROUNDS = 15;

    for (let round = 0; round < ROUNDS; round++) {
      let announceReady: () => void;
      const ready = new Promise<void>(resolve => (announceReady = resolve));

      const arrived = new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("no event within 10s")), 10_000);
        const subscription = (collection as any)
          .watch(undefined, {onReady: () => announceReady()})
          .subscribe({
            next: () => {
              clearTimeout(timer);
              subscription.unsubscribe();
              resolve(Number(process.hrtime.bigint()));
            },
            error: (error: Error) => {
              clearTimeout(timer);
              reject(error);
            }
          });
      });

      await ready;

      const committed = Number(process.hrtime.bigint());
      await collection.insertOne({
        title: {tr_TR: `Live TR ${round}`, en_US: `Live ${round}`},
        slug: `live-${round}-${Date.now()}`,
        views: round
      } as any);

      samples.push(((await arrived) - committed) / 1e6);
    }

    const p95 = +pct(samples, 95).toFixed(2);
    measured.push({
      shape: "Realtime: commit → event",
      p50: +pct(samples, 50).toFixed(2),
      p95,
      queries: 0
    });
    expect(p95).toBeLessThan(BUDGET.realtimeP95Ms);
  }, 300_000);

  /**
   * CDC write amplification is **not** asserted here, on purpose.
   *
   * It is a throughput measurement: 200 sequential inserts with the triggers attached against the same
   * burst without them. On the shared test server the CDC consumer's own polling round runs in the
   * background and moves the result between 3% and 27% across runs — an assertion on that would flake,
   * and a flaky benchmark gets deleted. The published number is measured in a quiet environment by
   * `scripts/measure-pg-cdc.mjs`.
   *
   * What CI does guard is the **structural** guarantee behind the number, and it is deterministic:
   * `postgres/test/cdc.spec.ts` inserts 50 rows in one statement and asserts the notification fired
   * **once**. That is the escape hatch; if someone moves `pg_notify` back to the row trigger, that
   * test fails immediately rather than a percentage drifting.
   */
});
