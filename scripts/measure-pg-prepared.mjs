#!/usr/bin/env node
/**
 * D6 — measuring whether prepared statements are worth adopting (postgresql-backend-plan.md §0.2, Phase 9).
 *
 * The question: the driver sends every query with `client.query(sql, params)`, which is `pg`'s
 * **unnamed** extended-protocol path — Parse + Bind + Execute on every call, with the server discarding
 * the plan immediately. A named prepared statement (`{name, text, values}`) parses once per connection
 * and reuses the plan. Is the gain measurable, and what does it cost?
 *
 * Three variants are measured so that the numbers can be interpreted:
 *   simple   — no parameters, values inlined into the SQL (one round trip; the protocol floor)
 *   unnamed  — `query(sql, params)`  ← the driver's CURRENT behaviour
 *   named    — `query({name, text, values})` (plan reuse)
 *
 * The SQL shapes were produced by the **real compilers** (`compileReadPlan`, `compileCrudFilter`,
 * `compileCrudUpdate`; 29 September 2026), not written by hand; the only deviation is that the table and
 * column names are pinned to the schema this script creates.
 *
 * The environment is kept identical to §5.2 so the numbers are comparable: `postgres:16`, 10,000 posts
 * plus 500 authors.
 */
import {execFileSync} from "child_process";
import pg from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const {Client, Pool} = pg;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE = "postgres:16";
const NAME = "spica-measure-prepared";
const PORT = Number(process.env.PORT ?? 45433);
const POSTS = Number(process.env.POSTS ?? 10_000);
const AUTHORS = 500;
const ITER = Number(process.env.ITER ?? 500);
const WARMUP = 50;
const ROUNDS = Number(process.env.ROUNDS ?? 2);
const CONN = {
  host: "127.0.0.1",
  port: PORT,
  user: "postgres",
  password: "measure",
  database: "postgres"
};

const sh = (c, a, o = {}) => execFileSync(c, a, {encoding: "utf8", ...o}).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const stats = a => ({
  p50: +pct(a, 50).toFixed(3),
  p95: +pct(a, 95).toFixed(3),
  p99: +pct(a, 99).toFixed(3),
  mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3)
});

async function timeIt(fn, iter = ITER, warmup = WARMUP) {
  for (let i = 0; i < warmup; i++) await fn();
  const samples = [];
  for (let i = 0; i < iter; i++) {
    const t = process.hrtime.bigint();
    await fn();
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  return stats(samples);
}

function up() {
  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
  sh("docker", [
    "run",
    "-d",
    "--name",
    NAME,
    "-p",
    `${PORT}:5432`,
    "-e",
    "POSTGRES_PASSWORD=measure",
    IMAGE,
    "-c",
    "max_connections=200"
  ]);
}
const down = () => {
  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
};

/**
 * A single successful query is not enough: the `postgres` image brings up a temporary server for `initdb`
 * and shuts it down again, and the first success can hit that one. Consecutive successes are required —
 * the same rule as `waitForPostgres`.
 */
async function waitReady() {
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const c = new Client(CONN);
    try {
      await c.connect();
      await c.query("SELECT 1");
      await c.end();
      if (++streak >= 3) return;
    } catch {
      streak = 0;
      try {
        await c.end();
      } catch {}
    }
    await sleep(400);
  }
  throw new Error("PostgreSQL did not become ready");
}

const DDL = `
CREATE SCHEMA bucket;

CREATE TABLE bucket.bucket_67b3 (
  _id  char(24) PRIMARY KEY,
  name text
);

CREATE TABLE bucket.bucket_67a1 (
  _id        char(24) PRIMARY KEY,
  title      jsonb,
  slug       text,
  views      double precision,
  published  boolean,
  created_at timestamptz,
  author     char(24) REFERENCES bucket.bucket_67b3(_id) ON DELETE SET NULL,
  tags       text[]
);

CREATE INDEX ON bucket.bucket_67a1 (views);
CREATE INDEX ON bucket.bucket_67a1 (slug);
CREATE INDEX ON bucket.bucket_67a1 (author);
CREATE INDEX ON bucket.bucket_67a1 USING gin (tags);
`;

async function seed(client) {
  await client.query(DDL);
  await client.query(
    `INSERT INTO bucket.bucket_67b3 (_id, name)
     SELECT lpad(to_hex(g), 24, '0'), 'Author ' || g
     FROM generate_series(1, $1) g`,
    [AUTHORS]
  );
  await client.query(
    `INSERT INTO bucket.bucket_67a1 (_id, title, slug, views, published, created_at, author, tags)
     SELECT lpad(to_hex(1000000 + g), 24, '0'),
            jsonb_build_object('tr_TR', 'Yazi ' || g, 'en_US', 'Post ' || g),
            'post-' || g,
            (g % 1000)::double precision,
            g % 3 = 0,
            now() - (g || ' minutes')::interval,
            lpad(to_hex(1 + (g % $2)), 24, '0'),
            ARRAY['t' || (g % 7), 't' || (g % 13)]
     FROM generate_series(1, $1) g`,
    [POSTS, AUTHORS]
  );
  await client.query("ANALYZE bucket.bucket_67a1");
  await client.query("ANALYZE bucket.bucket_67b3");
}

/**
 * The shapes being measured. `sql`/`params` is the compiler's output; `inline` is the same query without
 * parameters (the simple-protocol floor). When `inline` is absent that variant is skipped.
 */
const SHAPES = [
  {
    id: "findOne_by_id",
    title: "findOne({_id}) — the hottest path",
    sql: `SELECT * FROM bucket."bucket_67a1" WHERE "_id" = $1 LIMIT $2`,
    params: ["0000000000000000000f4629", 1],
    inline: `SELECT * FROM bucket."bucket_67a1" WHERE "_id" = '0000000000000000000f4629' LIMIT 1`
  },
  {
    id: "find_by_slug",
    title: "find({slug}) — compileCrudFilter",
    sql: `SELECT * FROM bucket."bucket_67a1" WHERE "slug" = $1 LIMIT $2`,
    params: ["post-42", 1],
    inline: `SELECT * FROM bucket."bucket_67a1" WHERE "slug" = 'post-42' LIMIT 1`
  },
  {
    id: "list_plain",
    title: "List, unfiltered, limit 25",
    sql: `SELECT b."_id", b."title", b."slug", b."views", b."published", b."created_at", b."author", b."tags"
FROM bucket."bucket_67a1" b
LIMIT $1`,
    params: [25],
    inline: `SELECT b."_id", b."title", b."slug", b."views", b."published", b."created_at", b."author", b."tags"
FROM bucket."bucket_67a1" b
LIMIT 25`
  },
  {
    id: "list_filter",
    title: "Filter + limit",
    sql: `SELECT b."_id", b."title", b."slug", b."views", b."published", b."created_at", b."author", b."tags"
FROM bucket."bucket_67a1" b
WHERE (b."views" > $1)
LIMIT $2`,
    params: [500, 25],
    inline: `SELECT b."_id", b."title", b."slug", b."views", b."published", b."created_at", b."author", b."tags"
FROM bucket."bucket_67a1" b
WHERE (b."views" > 500)
LIMIT 25`
  },
  {
    id: "list_paged_data",
    title: "Filter + sort + pagination (data)",
    sql: `SELECT b."_id", b."title", b."slug", b."views", b."published", b."created_at", b."author", b."tags"
FROM bucket."bucket_67a1" b
WHERE (b."views" > $1)
ORDER BY b."views" DESC
LIMIT $2 OFFSET $3`,
    params: [500, 25, 100],
    inline: `SELECT b."_id", b."title", b."slug", b."views", b."published", b."created_at", b."author", b."tags"
FROM bucket."bucket_67a1" b
WHERE (b."views" > 500)
ORDER BY b."views" DESC
LIMIT 25 OFFSET 100`
  },
  {
    id: "list_paged_count",
    title: "Pagination (count — the parallel second query)",
    sql: `SELECT count(*)::int AS total
FROM bucket."bucket_67a1" b
WHERE (b."views" > $1)`,
    params: [500],
    inline: `SELECT count(*)::int AS total
FROM bucket."bucket_67a1" b
WHERE (b."views" > 500)`
  },
  {
    id: "list_i18n",
    title: "i18n COALESCE + filter",
    sql: `SELECT b."_id", COALESCE(b."title"->>$2, b."title"->>$3) AS "title", b."slug", b."views", b."published", b."created_at", b."author", b."tags"
FROM bucket."bucket_67a1" b
WHERE (b."views" > $1)
LIMIT $4`,
    params: [500, "tr_TR", "en_US", 25],
    inline: `SELECT b."_id", COALESCE(b."title"->>'tr_TR', b."title"->>'en_US') AS "title", b."slug", b."views", b."published", b."created_at", b."author", b."tags"
FROM bucket."bucket_67a1" b
WHERE (b."views" > 500)
LIMIT 25`
  },
  {
    id: "list_relation_projection",
    title: "Relation for display (LATERAL, after LIMIT)",
    sql: `SELECT b."_id", b."title", b."slug", b."views", b."published", b."created_at", b."tags", r_author.value AS "author"
FROM (
  SELECT b."_id", b."title", b."slug", b."views", b."published", b."created_at", b."author" AS "author__id", b."tags"
  FROM bucket."bucket_67a1" b
  LIMIT $1
) b
LEFT JOIN LATERAL (
  SELECT jsonb_strip_nulls(to_jsonb(r_author_t)) AS value
  FROM bucket."bucket_67b3" r_author_t
  WHERE r_author_t."_id" = b."author__id"
) r_author ON true`,
    params: [25],
    inline: null
  },
  {
    id: "list_relation_filter",
    title: "Relation in the filter (LATERAL, before WHERE)",
    sql: `SELECT b."_id", b."title", b."slug", b."views", b."published", b."created_at", b."tags", r_author.value AS "author"
FROM bucket."bucket_67a1" b
LEFT JOIN LATERAL (
  SELECT jsonb_strip_nulls(to_jsonb(r_author_t)) AS value
  FROM bucket."bucket_67b3" r_author_t
  WHERE r_author_t."_id" = b."author"
) r_author ON true
WHERE (r_author.value->>'name' = $1)
LIMIT $2`,
    params: ["Author 7", 25],
    inline: null
  },
  {
    id: "update_by_id",
    title: "updateOne({_id}, {$set})",
    sql: `UPDATE bucket."bucket_67a1" SET "views" = $1 WHERE "_id" = $2`,
    params: [7, "0000000000000000000f4629"],
    inline: null
  }
];

/**
 * Every shape is measured `ROUNDS` times and the **best round** is reported.
 *
 * In a single round the p95 noise reaches 0.2 ms while the difference we are looking for is 0.03 ms; one
 * round cannot answer the question. Taking the minimum removes the background noise that pushes a
 * measurement up — there is no noise that pushes it down.
 */
async function measureShapes(runner, label) {
  const rows = [];
  for (const shape of SHAPES) {
    const best = (a, b) => (!a ? b : b.p50 < a.p50 ? b : a);
    let simple = null;
    let unnamed = null;
    let named = null;
    for (let r = 0; r < ROUNDS; r++) {
      if (shape.inline) simple = best(simple, await timeIt(() => runner.simple(shape.inline)));
      unnamed = best(unnamed, await timeIt(() => runner.unnamed(shape.sql, shape.params)));
      named = best(named, await timeIt(() => runner.named(shape.id, shape.sql, shape.params)));
    }
    rows.push({shape: shape.id, title: shape.title, simple, unnamed, named});
    const d50 = +(unnamed.p50 - named.p50).toFixed(3);
    const ratio = +(named.p50 / unnamed.p50).toFixed(2);
    console.log(
      `  ${shape.id.padEnd(26)} ` +
        `simple ${(simple ? simple.p50 : "—").toString().padStart(6)}/${(simple ? simple.p95 : "—").toString().padStart(6)}  ` +
        `unnamed ${unnamed.p50.toString().padStart(6)}/${unnamed.p95.toString().padStart(6)}  ` +
        `named ${named.p50.toString().padStart(6)}/${named.p95.toString().padStart(6)}  ` +
        `Δp50 ${d50.toString().padStart(7)} ms  (${ratio}×)`
    );
  }
  return {label, rows};
}

/**
 * The generic-plan risk — a prepared statement's classic regression.
 *
 * With `plan_cache_mode = auto` PostgreSQL may switch to a **generic** plan after the fifth execution,
 * that is, one plan chosen without looking at the parameter value. On a skewed distribution that is a bad
 * plan. The measurement runs the same prepared statement with a very selective value (one row) and with a
 * value that selects everything, and compares both against `force_custom_plan`.
 */
async function measureGenericPlanRisk(client) {
  const sql = `SELECT count(*)::int AS total FROM bucket."bucket_67a1" WHERE "views" < $1`;
  const selective = [1];
  const broad = [100000];

  const run = async (mode, params, name) => {
    await client.query(`SET plan_cache_mode = ${mode}`);
    const s = await timeIt(() => client.query({name, text: sql, values: params}), 60, 20);
    await client.query("RESET plan_cache_mode");
    return s;
  };

  const out = {
    selective_auto: await run("auto", selective, "gp_sel_auto"),
    selective_custom: await run("force_custom_plan", selective, "gp_sel_custom"),
    selective_generic: await run("force_generic_plan", selective, "gp_sel_generic"),
    broad_auto: await run("auto", broad, "gp_broad_auto"),
    broad_generic: await run("force_generic_plan", broad, "gp_broad_generic")
  };
  for (const [k, v] of Object.entries(out)) {
    console.log(`  ${k.padEnd(26)} p95 ${v.p95} ms`);
  }
  return out;
}

/**
 * `insertMany` currently issues one `INSERT` per document (`postgres.collection.ts:292` — "kept simple
 * until Phase 9 measures it"). The same question as D6: how large is the fixed per-statement cost, and
 * does a prepared statement or a multi-row `INSERT` remove it?
 */
async function measureInsertBatch(client) {
  const N = 100;
  const cols = `(_id, slug, views) VALUES`;
  const rowsOf = n =>
    Array.from({length: n}, (_, i) => [
      crypto.randomBytes(12).toString("hex"),
      `bulk-${i}-${crypto.randomBytes(3).toString("hex")}`,
      i
    ]);

  const perRowUnnamed = await timeIt(
    async () => {
      for (const [id, slug, views] of rowsOf(N)) {
        await client.query(`INSERT INTO bucket."bucket_67a1" ${cols} ($1, $2, $3)`, [
          id,
          slug,
          views
        ]);
      }
    },
    10,
    3
  );

  const perRowNamed = await timeIt(
    async () => {
      for (const [id, slug, views] of rowsOf(N)) {
        await client.query({
          name: "ins_one",
          text: `INSERT INTO bucket."bucket_67a1" ${cols} ($1, $2, $3)`,
          values: [id, slug, views]
        });
      }
    },
    10,
    3
  );

  const multiRow = await timeIt(
    async () => {
      const rows = rowsOf(N);
      const values = rows.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(", ");
      await client.query(
        `INSERT INTO bucket."bucket_67a1" (_id, slug, views) VALUES ${values}`,
        rows.flat()
      );
    },
    10,
    3
  );

  console.log(`  ${N} rows, one statement per row, unnamed   p95 ${perRowUnnamed.p95} ms`);
  console.log(`  ${N} rows, one statement per row, named     p95 ${perRowNamed.p95} ms`);
  console.log(`  ${N} rows, a single multi-row INSERT        p95 ${multiRow.p95} ms`);
  return {rows: N, perRowUnnamed, perRowNamed, multiRow};
}

async function main() {
  console.log(`D6 — prepared statements · ${POSTS} posts + ${AUTHORS} authors · ITER=${ITER}\n`);
  up();
  await waitReady();

  const seeder = new Client(CONN);
  await seeder.connect();
  await seed(seeder);
  await seeder.end();

  const report = {
    generatedAt: new Date().toISOString(),
    image: IMAGE,
    posts: POSTS,
    authors: AUTHORS,
    iterations: ITER,
    rounds: ROUNDS
  };

  // A single connection: the best case for plan reuse (one Parse for the whole run).
  const single = new Client(CONN);
  await single.connect();
  console.log("Single connection (dedicated client) — p50/p95 ms:");
  report.single = await measureShapes(
    {
      simple: sql => single.query(sql),
      unnamed: (sql, params) => single.query(sql, params),
      named: (id, sql, params) => single.query({name: `s_${id}`, text: sql, values: params})
    },
    "single client"
  );

  console.log("\nGeneric-plan risk:");
  report.genericPlan = await measureGenericPlanRisk(single);

  console.log("\nInsert batching (the loop insertMany runs today):");
  report.insertBatch = await measureInsertBatch(single);
  await single.end();

  /**
   * Through the pool: the production path. `pg` parses a named statement **per connection**, so with N
   * connections in the pool the first N calls still parse. The difference is measured with a warm pool.
   */
  const pool = new Pool({...CONN, max: 10});
  console.log("\nThrough the pool (max=10, the production path) — p50/p95 ms:");
  report.pool = await measureShapes(
    {
      simple: sql => pool.query(sql),
      unnamed: (sql, params) => pool.query(sql, params),
      named: (id, sql, params) => pool.query({name: `p_${id}`, text: sql, values: params})
    },
    "pool max=10"
  );
  await pool.end();

  const out = path.join(ROOT, "docs", "measure-pg-prepared.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(`\nJSON: ${path.relative(ROOT, out)}`);
}

main()
  .then(() => down())
  .catch(error => {
    console.error(error);
    down();
    process.exit(1);
  });
