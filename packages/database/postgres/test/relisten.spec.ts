import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {execFileSync} from "child_process";
import pg from "pg";
import {PostgresChangeStream} from "@spica-server/database-postgres";
import {
  compileCreateChangesTable,
  compileCreateSchemas,
  runIdempotentDdl
} from "@spica-server/database-postgres";

const {Client, Pool} = pg;
const EXTERNAL_URL = process.env.POSTGRES_URL;
const IMAGE = "postgres:16";
const NAME = "spica-relisten-test";
const PORT = 45933;
const PASSWORD = "relisten";

let pool: pg.Pool;
let uri: string;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

beforeAll(async () => {
  if (EXTERNAL_URL) {
    uri = EXTERNAL_URL;
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
      `POSTGRES_PASSWORD=${PASSWORD}`,
      IMAGE
    ]);
    uri = `postgres://postgres:${PASSWORD}@127.0.0.1:${PORT}/postgres`;

    for (let attempt = 0; attempt < 90; attempt++) {
      const probe = new Client({connectionString: uri, connectionTimeoutMillis: 1000});
      try {
        await probe.connect();
        await probe.query("SELECT 1");
        await probe.end();
        break;
      } catch {
        await probe.end().catch(() => {});
        await sleep(400);
      }
    }
  }

  pool = new Pool({connectionString: uri, max: 3});
  for (const statement of compileCreateSchemas()) await runIdempotentDdl(pool, statement.sql);
  for (const statement of compileCreateChangesTable())
    await runIdempotentDdl(pool, statement.sql, statement.params);
}, 180_000);

afterAll(async () => {
  await pool?.end().catch(() => {});
  if (!EXTERNAL_URL) {
    try {
      execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
    } catch {}
  }
});

/**
 * `LISTEN` dies with its session and `pg`'s `Client` never re-issues it, so a single dropped connection used
 * to leave change capture on the poll interval for the rest of the process's life — correct, but silently
 * slower, with nothing in the logs (D8).
 *
 * The connection is dropped the way it drops in production: from the **server** side, with
 * `pg_terminate_backend`.
 */
describe("LISTEN after the connection drops", () => {
  async function terminate(pid: number) {
    await pool.query(`SELECT pg_terminate_backend($1)`, [pid]);
  }

  it("re-registers on the replacement connection and keeps notifying", async () => {
    let client = new Client({connectionString: uri});
    await client.connect();
    // Swallow the drop; without a handler `pg` raises it as an unhandled error.
    client.on("error", () => {});

    const stream = new PostgresChangeStream(pool, {
      // The provider form: the owner replaces the client, the stream follows it (D8).
      listenClient: () => client,
      pollIntervalMs: 60_000
    });
    await stream.start();

    const notifications: number[] = [];
    const seen = new Promise<void>(resolve => {
      const subscription = stream.changes(undefined, {}).subscribe({
        next: () => {
          notifications.push(Date.now());
          if (notifications.length >= 1) {
            subscription.unsubscribe();
            resolve();
          }
        },
        error: () => {}
      });
    });

    const {rows} = await client.query<{pid: number}>("SELECT pg_backend_pid() AS pid");
    await terminate(rows[0].pid);
    await sleep(300);

    // What the adapter's `ListenConnection` does on its own: open a replacement and hand it over.
    const replacement = new Client({connectionString: uri});
    await replacement.connect();
    replacement.on("error", () => {});
    client = replacement;

    // A polling round is what re-issues `LISTEN`; the interval is long here so the round has to be the one
    // this test triggers, not a lucky tick.
    await (stream as unknown as {relisten(): Promise<void>}).relisten();

    await pool.query(
      `INSERT INTO spica._changes (coll, op, doc_id, full_doc) VALUES ('t', 'insert', 'x', '{}'::jsonb)`
    );
    await pool.query(`SELECT pg_notify('spica_changes', '')`);

    await Promise.race([seen, sleep(10_000)]);
    await stream.stop();
    await client.end().catch(() => {});

    expect(notifications.length).toBeGreaterThan(0);
  }, 60_000);
});
