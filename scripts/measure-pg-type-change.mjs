#!/usr/bin/env node
/**
 * D7 / AK-5 — measuring the type-change threshold (postgresql-backend-plan.md §0.2, §7).
 *
 * AK-5's question: "on a small table `ALTER … TYPE … USING` is enough; on a large one a shadow column
 * plus a batched backfill plus a swap is needed. Is the threshold a row count or an estimated duration?"
 *
 * The code as it stands (`postgres.schema-manager.ts`) **declares `rewriteThreshold` and never uses it**:
 * `requiresRewrite = true` on every type change. So the panel would warn "this may take a while" on a 2 ms
 * catalog operation too. The measurement's job is to tie that flag to reality.
 *
 * Two paths are measured separately, because **their costs are not in the same order of magnitude**:
 *   clear  — `DROP COLUMN` + `ADD COLUMN`  ← the path Spica uses for a bucket type change
 *            (the product rule: a type change clears the field's values, `SchemaPlanHints`)
 *   alter  — `ALTER COLUMN TYPE … USING`   ← `plan()`'s general contract (a careful migration)
 *
 * What is measured is the **lock hold time**: `ALTER TABLE` takes `ACCESS EXCLUSIVE`, so the number that
 * matters to an operator is "how long were writes blocked".
 */
import {execFileSync} from "child_process";
import pg from "pg";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const {Client} = pg;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE = "postgres:16";
const NAME = "spica-measure-typechange";
const PORT = Number(process.env.PORT ?? 45434);
const SIZES = (process.env.SIZES ?? "1000,10000,100000,1000000").split(",").map(Number);
const REPEAT = Number(process.env.REPEAT ?? 3);
const CONN = {
  host: "127.0.0.1",
  port: PORT,
  user: "postgres",
  password: "measure",
  database: "postgres"
};

const sh = (c, a, o = {}) => execFileSync(c, a, {encoding: "utf8", ...o}).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ms = n => +n.toFixed(2);

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
    "max_connections=100"
  ]);
}
const down = () => {
  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
};

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

/**
 * The table under measurement has the shape of a bucket data table: a `_id char(24)` primary key, a
 * `jsonb` column for i18n, an array column, and the `views` column whose type gets changed.
 */
async function createTable(client, table, rows) {
  await client.query(`DROP TABLE IF EXISTS bucket."${table}"`);
  await client.query(
    `CREATE TABLE bucket."${table}" (
       _id        char(24) PRIMARY KEY,
       title      jsonb,
       slug       text,
       views      text,
       published  boolean,
       created_at timestamptz,
       tags       text[]
     )`
  );
  await client.query(
    `INSERT INTO bucket."${table}" (_id, title, slug, views, published, created_at, tags)
     SELECT lpad(to_hex(g), 24, '0'),
            jsonb_build_object('tr_TR', 'Yazi ' || g, 'en_US', 'Post ' || g),
            'post-' || g,
            (g % 1000)::text,
            g % 3 = 0,
            now() - (g || ' minutes')::interval,
            ARRAY['t' || (g % 7)]
     FROM generate_series(1, $1) g`,
    [rows]
  );
  await client.query(`CREATE INDEX ON bucket."${table}" (slug)`);
  await client.query(`ANALYZE bucket."${table}"`);
}

const tableBytes = async (client, table) =>
  Number(
    (await client.query(`SELECT pg_total_relation_size($1) AS b`, [`bucket.${table}`])).rows[0].b
  );

/** Runs a DDL inside a transaction and measures the **lock hold time**. */
async function timeDdl(client, statements) {
  const t = process.hrtime.bigint();
  await client.query("BEGIN");
  for (const sql of statements) await client.query(sql);
  await client.query("COMMIT");
  return Number(process.hrtime.bigint() - t) / 1e6;
}

/**
 * The `reltuples` estimate — this is what `plan()`'s threshold reads, not `count(*)`: the threshold check
 * must not itself scan the whole table (the same decision as `estimatedDocumentCount`).
 */
async function estimate(client, table) {
  const {rows} = await client.query(
    `SELECT GREATEST(reltuples, 0)::bigint::int AS estimate
     FROM pg_class WHERE oid = $1::regclass`,
    [`bucket.${table}`]
  );
  return rows[0].estimate;
}

async function measureSize(client, rows) {
  const table = `bucket_tc_${rows}`;
  const result = {rows};

  // ── the clear path: DROP COLUMN + ADD COLUMN (Spica's bucket type change)
  const clearSamples = [];
  for (let i = 0; i < REPEAT; i++) {
    await createTable(client, table, rows);
    const before = await tableBytes(client, table);
    clearSamples.push(
      await timeDdl(client, [
        `ALTER TABLE bucket."${table}" DROP COLUMN "views"`,
        `ALTER TABLE bucket."${table}" ADD COLUMN "views" double precision`
      ])
    );
    if (i === 0) {
      result.estimate = await estimate(client, table);
      result.bytesBefore = before;
      result.bytesAfterClear = await tableBytes(client, table);
    }
  }
  result.clear = ms(median(clearSamples));

  // ── the alter path: ALTER COLUMN TYPE … USING (a full table rewrite)
  const alterSamples = [];
  for (let i = 0; i < REPEAT; i++) {
    await createTable(client, table, rows);
    alterSamples.push(
      await timeDdl(client, [
        `ALTER TABLE bucket."${table}" ALTER COLUMN "views" TYPE double precision ` +
          `USING "views"::double precision`
      ])
    );
    if (i === 0) result.bytesAfterAlter = await tableBytes(client, table);
  }
  result.alter = ms(median(alterSamples));

  // ── the baseline: an ADD COLUMN known to be a catalog operation (nullable, no DEFAULT)
  const addSamples = [];
  for (let i = 0; i < REPEAT; i++) {
    await createTable(client, table, rows);
    addSamples.push(
      await timeDdl(client, [`ALTER TABLE bucket."${table}" ADD COLUMN "extra" text`])
    );
  }
  result.addColumn = ms(median(addSamples));

  await client.query(`DROP TABLE IF EXISTS bucket."${table}"`);

  console.log(
    `  ${String(rows).padStart(8)} rows  ` +
      `clear ${String(result.clear).padStart(8)} ms   ` +
      `alter ${String(result.alter).padStart(9)} ms   ` +
      `addColumn ${String(result.addColumn).padStart(7)} ms   ` +
      `alter/clear ${(result.alter / result.clear).toFixed(0)}×`
  );
  return result;
}

/**
 * `lock_timeout` behaviour: an `ALTER TABLE` queues up behind a long-running read, and while it waits for
 * `ACCESS EXCLUSIVE` **every read after it waits too**. That is the rationale for the driver's
 * `lock_timeout` plus retry; this measurement verifies that `55P03` really fires (it was measured on the
 * prototype in step S, and is repeated here with the driver's own default).
 */
async function measureLockTimeout(client, rows) {
  const table = "bucket_tc_lock";
  await createTable(client, table, rows);

  const reader = new Client(CONN);
  await reader.connect();
  await reader.query("BEGIN");
  await reader.query(`SELECT count(*) FROM bucket."${table}"`);

  const writer = new Client(CONN);
  await writer.connect();
  await writer.query("SET lock_timeout = '3s'");

  const t = process.hrtime.bigint();
  let code = null;
  try {
    await writer.query(`ALTER TABLE bucket."${table}" ADD COLUMN "blocked" text`);
  } catch (error) {
    code = error.code;
  }
  const waited = Number(process.hrtime.bigint() - t) / 1e6;

  await reader.query("ROLLBACK");
  await reader.end();
  await writer.end();
  await client.query(`DROP TABLE IF EXISTS bucket."${table}"`);

  console.log(
    `  lock_timeout=3s, behind an open read transaction → ${code ?? "lock acquired"} (${ms(waited)} ms)`
  );
  return {code, waitedMs: ms(waited), expected: "55P03"};
}

async function main() {
  console.log(
    `D7 / AK-5 — type-change threshold · row counts: ${SIZES.join(", ")} · REPEAT=${REPEAT}\n`
  );
  up();
  await waitReady();

  const client = new Client(CONN);
  await client.connect();
  await client.query("CREATE SCHEMA IF NOT EXISTS bucket");

  const report = {
    generatedAt: new Date().toISOString(),
    image: IMAGE,
    repeat: REPEAT,
    sizes: []
  };

  console.log("DDL durations (lock hold time, inside a transaction):");
  for (const rows of SIZES) report.sizes.push(await measureSize(client, rows));

  console.log("\nlock_timeout behaviour:");
  report.lockTimeout = await measureLockTimeout(client, 10_000);

  await client.end();

  const out = path.join(ROOT, "docs", "measure-pg-type-change.json");
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
