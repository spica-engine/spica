#!/usr/bin/env node
/**
 * §5 — CDC write amplification, measured on the real trigger set (Phase 9).
 *
 * §5.2 measured **50%** on the prototype, with 38 of those points coming from calling `pg_notify` once
 * per row. That is what made Phase 5's escape hatch mandatory rather than optional: the budget's
 * threshold is 20%. R18 split the work into two triggers — a row trigger that only writes the outbox,
 * and a **statement** trigger that notifies once. This measures what that bought.
 *
 * Three variants, matching §5.2 so the numbers are comparable:
 *   none    — no trigger at all (the floor)
 *   row     — the row trigger only: the outbox insert, no notification
 *   full    — the row trigger plus the statement-level notify trigger (what production runs)
 *
 * It runs in its own container with nothing else connected, because this is a **throughput**
 * measurement: on a shared server a background polling round moves the result by an order of
 * magnitude. The structural guarantee behind the number — one notification per statement, not per row —
 * is asserted deterministically in `postgres/test/cdc.spec.ts` and belongs in CI; this does not.
 */
import {execFileSync} from "child_process";
import pg from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const {Client} = pg;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE = "postgres:16";
const NAME = "spica-measure-cdc";
const PORT = Number(process.env.PORT ?? 45436);
const ROWS = Number(process.env.ROWS ?? 2000);
const REPEAT = Number(process.env.REPEAT ?? 5);
const CONN = {
  host: "127.0.0.1",
  port: PORT,
  user: "postgres",
  password: "measure",
  database: "postgres"
};

const sh = (c, a, o = {}) => execFileSync(c, a, {encoding: "utf8", ...o}).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const oid = () => crypto.randomBytes(12).toString("hex");

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
    IMAGE
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
 * The outbox and the two trigger functions, copied from `changes-schema.ts` so the measurement runs the
 * production SQL. Keeping them here rather than importing avoids a build step for a one-off script; if
 * the real definitions change, this number has to be measured again.
 */
const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS spica;
CREATE SCHEMA IF NOT EXISTS bucket;

CREATE TABLE spica._changes (
  seq     bigserial PRIMARY KEY,
  txid    xid8 NOT NULL DEFAULT pg_current_xact_id(),
  ts      timestamptz NOT NULL DEFAULT now(),
  coll    text NOT NULL,
  op      text NOT NULL,
  doc_id  text,
  full_doc        jsonb,
  before_doc      jsonb,
  updated_fields  jsonb,
  removed_fields  jsonb
);

CREATE OR REPLACE FUNCTION spica.spica_changes_row() RETURNS trigger AS $$
DECLARE
  op text;
  doc jsonb;
  before jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    op := 'insert'; doc := to_jsonb(NEW); before := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    op := 'update'; doc := to_jsonb(NEW); before := to_jsonb(OLD);
  ELSE
    op := 'delete'; doc := NULL; before := to_jsonb(OLD);
  END IF;

  INSERT INTO spica._changes (coll, op, doc_id, full_doc, before_doc)
  VALUES (TG_TABLE_NAME, op, COALESCE(doc->>'_id', before->>'_id'), doc, before);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION spica.spica_changes_notify() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('spica_changes', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE bucket.amp (
  _id   char(24) PRIMARY KEY,
  slug  text,
  views double precision
);
`;

const attach = {
  none: [
    `DROP TRIGGER IF EXISTS amp_row ON bucket.amp`,
    `DROP TRIGGER IF EXISTS amp_notify ON bucket.amp`
  ],
  row: [
    `DROP TRIGGER IF EXISTS amp_notify ON bucket.amp`,
    `CREATE OR REPLACE TRIGGER amp_row AFTER INSERT OR UPDATE OR DELETE ON bucket.amp
       FOR EACH ROW EXECUTE FUNCTION spica.spica_changes_row()`
  ],
  full: [
    `CREATE OR REPLACE TRIGGER amp_row AFTER INSERT OR UPDATE OR DELETE ON bucket.amp
       FOR EACH ROW EXECUTE FUNCTION spica.spica_changes_row()`,
    `CREATE OR REPLACE TRIGGER amp_notify AFTER INSERT OR UPDATE OR DELETE ON bucket.amp
       FOR EACH STATEMENT EXECUTE FUNCTION spica.spica_changes_notify()`
  ]
};

/**
 * Serial single-row inserts, the same shape §5.2 used: the driver issues one statement per document
 * today, so this is what a write actually costs. The **minimum** of the repeats is reported — background
 * noise can only push a measurement up.
 */
async function burst(client) {
  const started = process.hrtime.bigint();
  for (let i = 0; i < ROWS; i++) {
    await client.query(`INSERT INTO bucket.amp (_id, slug, views) VALUES ($1, $2, $3)`, [
      oid(),
      `s-${i}`,
      i
    ]);
  }
  return Number(process.hrtime.bigint() - started) / 1e6;
}

async function measure(client, variant) {
  for (const sql of attach[variant]) await client.query(sql);

  const samples = [];
  for (let i = 0; i < REPEAT; i++) {
    await client.query(`TRUNCATE bucket.amp`);
    await client.query(`TRUNCATE spica._changes`);
    samples.push(await burst(client));
  }
  const ms = Math.min(...samples);
  const perInsert = ms / ROWS;
  console.log(
    `  ${variant.padEnd(6)} ${ms.toFixed(0).padStart(6)} ms   ` +
      `${(ROWS / (ms / 1000)).toFixed(0).padStart(6)} insert/s   ` +
      `${perInsert.toFixed(3)} ms/insert`
  );
  return {variant, ms: +ms.toFixed(1), perInsertMs: +perInsert.toFixed(4)};
}

async function main() {
  console.log(`§5 — CDC write amplification · ${ROWS} serial inserts × ${REPEAT} repeats\n`);
  up();
  await waitReady();

  const client = new Client(CONN);
  await client.connect();
  await client.query(SCHEMA);

  console.log("Variants (best of the repeats):");
  const none = await measure(client, "none");
  const row = await measure(client, "row");
  const full = await measure(client, "full");

  const outboxCost = (row.perInsertMs - none.perInsertMs) / none.perInsertMs;
  const notifyCost = (full.perInsertMs - row.perInsertMs) / none.perInsertMs;
  const total = (full.perInsertMs - none.perInsertMs) / none.perInsertMs;

  console.log(
    `\n  outbox insert        %${(outboxCost * 100).toFixed(1)}` +
      `\n  statement notify     %${(notifyCost * 100).toFixed(1)}` +
      `\n  total amplification  %${(total * 100).toFixed(1)}   (§5 threshold: %20)`
  );

  await client.end();

  const report = {
    generatedAt: new Date().toISOString(),
    image: IMAGE,
    rows: ROWS,
    repeat: REPEAT,
    variants: {none, row, full},
    amplification: {
      outbox: +(outboxCost * 100).toFixed(1),
      notify: +(notifyCost * 100).toFixed(1),
      total: +(total * 100).toFixed(1)
    }
  };
  const out = path.join(ROOT, "docs", "measure-pg-cdc.json");
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
