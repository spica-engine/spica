import {afterAll, afterEach, beforeAll, describe, expect, it} from "@jest/globals";
import {execFileSync} from "child_process";
import {Client, Pool} from "pg";
import {Bucket} from "@spica-server/interface-bucket";
import {DatabaseChange, isId, ResumeToken} from "@spica-server/database-driver";
import {
  bucketToTable,
  compileAttachTriggers,
  compileCreateChangesTable,
  compileCreateSchemas,
  runIdempotentDdl,
  compileCreateTable,
  compileCreateTriggerFunctions,
  BUCKET_SCHEMA,
  CHANGES_CHANNEL,
  ChangeHistoryLostError,
  PostgresChangeStream,
  PostgresDatabase,
  SYSTEM_SCHEMA,
  waitForPostgres
} from "@spica-server/database-postgres";

/**
 * The CDC acceptance test.
 *
 * The most important test in this file is the concurrency test: N parallel writers, random
 * rollbacks, conflicting updates to the same document. Three things are verified: every committed row
 * is delivered **exactly once**, the rolled back ones are delivered **never**, and per-document order
 * is preserved.
 *
 * Step S ran this test as a prototype and measured the `seq` watermark missing 12 events out of 3,031
 * commits; here it is repeated against the real driver.
 */
const IMAGE = "postgres:16";
const NAME = "spica-cdc-pg";
const PORT = 45435;
const EXTERNAL_URL = process.env.POSTGRES_URL;

const COLLECTION = "bucket_67e10000000000000000cdc1";

const SCHEMA = {
  _id: "67e10000000000000000cdc1" as any,
  title: "CDC",
  description: "",
  primary: "title",
  acl: {read: "true==true", write: "true==true"},
  properties: {
    title: {type: "string"},
    views: {type: "number"},
    note: {type: "string"}
  }
} as unknown as Bucket;

let pool: Pool;
let database: PostgresDatabase;

const oid = (n: number) => String(n).padStart(24, "0");

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
      "POSTGRES_PASSWORD=cdc",
      IMAGE
    ]);

    const config = {
      host: "127.0.0.1",
      port: PORT,
      user: "postgres",
      password: "cdc",
      database: "postgres"
    };

    /**
     * A single successful `SELECT 1` is not enough: the `postgres` image brings up a temporary
     * server for `initdb` and shuts it down again, the first success can hit that one, and the
     * connection is reset right afterwards. `waitForPostgres` requires consecutive successes.
     */
    await waitForPostgres(config);
    pool = new Pool({...config, max: 40});
  }

  database = new PostgresDatabase(pool, "cdc", {
    resolveSchema: name => (name === COLLECTION ? SCHEMA : undefined),
    changeStream: {pollIntervalMs: 50}
  });
  await database.bootstrap();

  const table = {...bucketToTable(SCHEMA), collection: COLLECTION};
  for (const statement of compileCreateTable(table)) {
    await runIdempotentDdl(pool, statement.sql, statement.params);
  }
  await database.ensureTriggers(COLLECTION);
}, 180_000);

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

afterEach(async () => {
  await pool.query(`DELETE FROM ${BUCKET_SCHEMA}."${COLLECTION}"`);
  await pool.query(`TRUNCATE ${SYSTEM_SCHEMA}."_changes"`);
});

const stream = () => new PostgresChangeStream(pool, {pollIntervalMs: 50});

/** Pins the watermark to now; the tests read everything after that. */
async function frontier(): Promise<string> {
  const {rows} = await pool.query<{x: string}>(
    `SELECT pg_snapshot_xmin(pg_current_snapshot())::text AS x`
  );
  return rows[0].x;
}

/**
 * Repeats the round until no new event arrives.
 *
 * A single round is not enough: the `txid < xmin` boundary deliberately leaves out the transactions
 * that commit after the moment the round was pinned (that is where the correctness comes from). So the
 * tests read "until they have all arrived" — the counterpart of the notify/polling loop in production.
 */
async function drain(
  from: string,
  filter: Parameters<PostgresChangeStream["readRound"]>[1] = {},
  attempts = 40
): Promise<{changes: DatabaseChange[]; next: string}> {
  const instance = stream();
  const collected: DatabaseChange[] = [];
  let watermark = from;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const round = await instance.readRound(watermark, filter);
    watermark = round.next;
    collected.push(...round.changes);
    if (!round.changes.length) await new Promise(resolve => setTimeout(resolve, 25));
  }

  return {changes: collected, next: watermark};
}

describe("semantic mapping — Mongo change stream fields", () => {
  it("insert: operation, collection, documentId, document", async () => {
    const from = await frontier();
    const collection = database.collection(COLLECTION);
    await collection.insertOne({_id: oid(1), title: "a", views: 1} as any);

    const {changes} = await drain(from, {collection: COLLECTION});
    expect(changes).toHaveLength(1);
    expect(changes[0].operation).toBe("insert");
    expect(changes[0].collection).toBe(COLLECTION);
    expect(String(changes[0].documentId)).toBe(oid(1));
    expect(changes[0].document.title).toBe("a");
  });

  it("update: updatedFields carries the changed field, previousDocument the earlier state", async () => {
    const collection = database.collection(COLLECTION);
    await collection.insertOne({_id: oid(2), title: "a", views: 1} as any);

    const from = await frontier();
    await collection.updateOne({_id: oid(2)} as any, {$set: {views: 9}} as any);

    const {changes} = await drain(from, {collection: COLLECTION, operations: ["update"]});
    expect(changes).toHaveLength(1);
    expect(changes[0].operation).toBe("update");
    // name→value. Returning a list of names only silently broke functions that write
    // `if (updatedFields.status === "paid")`.
    expect(changes[0].updatedFields).toEqual({views: 9});
    expect(changes[0].previousDocument.views).toBe(1);
    expect(changes[0].document.views).toBe(9);
  });

  it("removedFields: a field set to null counts as removed", async () => {
    const collection = database.collection(COLLECTION);
    await collection.insertOne({_id: oid(3), title: "a", note: "x"} as any);

    const from = await frontier();
    await collection.updateOne({_id: oid(3)} as any, {$unset: {note: ""}} as any);

    const {changes} = await drain(from, {collection: COLLECTION, operations: ["update"]});
    expect(changes).toHaveLength(1);
    expect(changes[0].removedFields).toEqual(["note"]);
  });

  it("replace arrives as an operation SEPARATE from update", async () => {
    const collection = database.collection(COLLECTION);
    await collection.insertOne({_id: oid(4), title: "a", views: 1} as any);

    const from = await frontier();
    await collection.replaceOne({_id: oid(4)} as any, {title: "b", views: 2} as any);

    const {changes} = await drain(from, {collection: COLLECTION});
    expect(changes).toHaveLength(1);
    expect(changes[0].operation).toBe("replace");
  });

  it("delete: previousDocument is filled, document is absent", async () => {
    const collection = database.collection(COLLECTION);
    await collection.insertOne({_id: oid(5), title: "a"} as any);

    const from = await frontier();
    await collection.deleteOne({_id: oid(5)} as any);

    const {changes} = await drain(from, {collection: COLLECTION, operations: ["delete"]});
    expect(changes).toHaveLength(1);
    expect(changes[0].operation).toBe("delete");
    expect(changes[0].previousDocument.title).toBe("a");
    expect(changes[0].document).toBeUndefined();
  });

  it("carries a (txid, seq) token pair", async () => {
    const from = await frontier();
    await database.collection(COLLECTION).insertOne({_id: oid(6), title: "a"} as any);

    const {changes} = await drain(from, {collection: COLLECTION});
    expect(changes[0].token.txid).toMatch(/^\d+$/);
    expect(changes[0].token.seq).toMatch(/^\d+$/);
  });
});

describe("filters reach the driver", () => {
  it("a collection filter does not bring in events from other tables", async () => {
    const other = "bucket_67e10000000000000000cdc2";
    const otherSchema = {...SCHEMA, _id: "67e10000000000000000cdc2" as any};
    const table = {...bucketToTable(otherSchema as Bucket), collection: other};
    for (const statement of compileCreateTable(table)) {
      await pool.query(statement.sql, statement.params);
    }
    await database.ensureTriggers(other);

    const from = await frontier();
    await pool.query(`INSERT INTO ${BUCKET_SCHEMA}."${other}" ("_id", "title") VALUES ($1, $2)`, [
      oid(7),
      "other"
    ]);
    await database.collection(COLLECTION).insertOne({_id: oid(8), title: "mine"} as any);

    const {changes} = await drain(from, {collection: COLLECTION});
    expect(changes).toHaveLength(1);
    expect(String(changes[0].documentId)).toBe(oid(8));

    await pool.query(`DROP TABLE ${BUCKET_SCHEMA}."${other}" CASCADE`);
  });

  it("the operations filter is the counterpart of Mongo's $match operationType", async () => {
    const collection = database.collection(COLLECTION);
    const from = await frontier();
    await collection.insertOne({_id: oid(9), title: "a"} as any);
    await collection.updateOne({_id: oid(9)} as any, {$set: {title: "b"}} as any);
    await collection.deleteOne({_id: oid(9)} as any);

    const {changes} = await drain(from, {
      collection: COLLECTION,
      operations: ["insert", "delete"]
    });
    expect(changes.map(c => c.operation)).toEqual(["insert", "delete"]);
  });
});

describe("resume", () => {
  it("resumeAfter does not repeat the token itself, it returns what follows it", async () => {
    const collection = database.collection(COLLECTION);
    const from = await frontier();
    await collection.insertOne({_id: oid(10), title: "a"} as any);
    await collection.insertOne({_id: oid(11), title: "b"} as any);
    await collection.insertOne({_id: oid(12), title: "c"} as any);

    const {changes} = await drain(from, {collection: COLLECTION});
    expect(changes.map(c => String(c.documentId))).toEqual([oid(10), oid(11), oid(12)]);

    // The real subscription path: resume from the token.
    const resumed = await collectFrom(changes[0].token, 2);
    expect(resumed.map(c => String(c.documentId))).toEqual([oid(11), oid(12)]);
  }, 60_000);

  /**
   * The critical edge of resuming: an event that arrives AFTER the token's window must not be
   * skipped even when its `seq` is smaller than the token's. Skipping on `seq` alone would lose events
   * exactly here.
   */
  it("an event with a smaller seq in the next window is not skipped", async () => {
    const collection = database.collection(COLLECTION);
    const from = await frontier();
    await collection.insertOne({_id: oid(18), title: "first"} as any);

    const {changes} = await drain(from, {collection: COLLECTION});
    expect(changes).toHaveLength(1);
    const token = changes[0].token;

    await collection.insertOne({_id: oid(19), title: "ikinci"} as any);

    // Lowering `seq` by hand sets up the "new window, small seq" case.
    await pool.query(`UPDATE ${SYSTEM_SCHEMA}."_changes" SET "seq" = 1 WHERE "doc_id" = $1`, [
      oid(19)
    ]);

    const resumed = await collectFrom(token, 1);
    expect(resumed.map(c => String(c.documentId))).toEqual([oid(19)]);
  }, 60_000);

  /**
   * A token past the retention period. The counterpart of MongoDB's `ChangeStreamHistoryLost`: silently
   * resuming from now would mean never telling the consumer which events it lost.
   */
  it("a token older than the retained history yields ChangeStreamHistoryLost", async () => {
    const collection = database.collection(COLLECTION);
    await collection.insertOne({_id: oid(13), title: "older"} as any);

    // A real retention sweep: the oldest rows are deleted.
    const swept = await pool.query(`DELETE FROM ${SYSTEM_SCHEMA}."_changes"`);
    expect(swept.rowCount).toBeGreaterThan(0);
    await collection.insertOne({_id: oid(14), title: "newer"} as any);

    const ancient: ResumeToken = {txid: "1", seq: "1"};

    await expect(
      new Promise((resolve, reject) => {
        stream().changes(COLLECTION, {resumeAfter: ancient}).subscribe({
          next: resolve,
          error: reject
        });
      })
    ).rejects.toThrow(ChangeHistoryLostError);
  }, 30_000);
});

describe("the concurrency acceptance test", () => {
  /**
   * 24 parallel writers, 40 transactions per writer, 20% of them rolled back.
   *
   * The `seq` watermark was missing events under this load (step S: 12 out of 3,031 commits); with the
   * `txid` watermark the number missed has to be 0. This test measures that.
   */
  it("delivers every committed event exactly once and no rolled back one at all", async () => {
    const WRITERS = 24;
    const PER_WRITER = 40;
    const from = await frontier();

    const committed = new Set<string>();
    const rolledBack = new Set<string>();

    await Promise.all(
      Array.from({length: WRITERS}, async (_, writer) => {
        const client = await pool.connect();
        try {
          for (let i = 0; i < PER_WRITER; i++) {
            const id = oid(writer * 1000 + i + 100000);
            const abort = (writer + i) % 5 === 0;
            await client.query("BEGIN");
            await client.query(
              `INSERT INTO ${BUCKET_SCHEMA}."${COLLECTION}" ("_id", "title", "views")
               VALUES ($1, $2, $3)`,
              [id, `w${writer}`, i]
            );
            if (abort) {
              await client.query("ROLLBACK");
              rolledBack.add(id);
            } else {
              await client.query("COMMIT");
              committed.add(id);
            }
          }
        } finally {
          client.release();
        }
      })
    );

    const {changes} = await drain(from, {collection: COLLECTION, operations: ["insert"]}, 80);
    const delivered = changes.map(change => String(change.documentId));

    // 1) Nothing lost.
    const missing = [...committed].filter(id => !delivered.includes(id));
    expect(missing).toEqual([]);

    // 2) No duplicates.
    expect(new Set(delivered).size).toBe(delivered.length);

    // 3) The rolled back ones never arrived.
    const leaked = delivered.filter(id => rolledBack.has(id));
    expect(leaked).toEqual([]);

    expect(delivered).toHaveLength(committed.size);
  }, 180_000);

  /**
   * **Per-document order = the event chain being unbroken.**
   *
   * The assertion I wrote first was wrong: under 30 concurrent updates the "real order" is not
   * `1,2,3,…` but the order in which the row lock is granted — and that is random. The one correct
   * observable invariant is this: every event's `previousDocument` has to be the `document` of the
   * event before it. If the chain breaks, a consumer (realtime, a database trigger) reacts to an
   * intermediate state that never existed.
   *
   * This test FAILS with `ORDER BY txid, seq` and passes with `ORDER BY seq`.
   */
  it("keeps the event chain unbroken under conflicting updates to the same document", async () => {
    const id = oid(200001);
    await database.collection(COLLECTION).insertOne({_id: id, title: "a", views: 0} as any);

    const from = await frontier();
    const ROUNDS = 30;

    await Promise.all(
      Array.from({length: ROUNDS}, async (_, i) => {
        const client = await pool.connect();
        try {
          await client.query(
            `UPDATE ${BUCKET_SCHEMA}."${COLLECTION}" SET "views" = $1 WHERE "_id" = $2`,
            [i + 1, id]
          );
        } finally {
          client.release();
        }
      })
    );

    const {changes} = await drain(from, {collection: COLLECTION, operations: ["update"]}, 80);
    expect(changes).toHaveLength(ROUNDS);

    for (let i = 1; i < changes.length; i++) {
      expect(changes[i].previousDocument.views).toBe(changes[i - 1].document.views);
    }

    // The end of the chain has to be the table's real final state.
    const {rows} = await pool.query<{views: number}>(
      `SELECT "views" FROM ${BUCKET_SCHEMA}."${COLLECTION}" WHERE "_id" = $1`,
      [id]
    );
    expect(changes[changes.length - 1].document.views).toBe(rows[0].views);
  }, 180_000);
});

/**
 * `watch()` — emits CDC **in Mongo's shape**.
 *
 * What is verified: production code (`realtime`, `webhook/invoker`, `enqueuer`) reads this payload as a
 * raw Mongo change document and has to work **unchanged** on PostgreSQL too. The field names are not
 * invented here, Mongo's contract is met.
 */
describe("watch() — a payload in Mongo's shape", () => {
  const collect = (
    pipeline: object[] | undefined,
    expected: number,
    timeoutMs = 8_000
  ): Promise<any[]> =>
    new Promise((resolve, reject) => {
      const seen: any[] = [];
      const subscription = database
        .collection(COLLECTION)
        .watch(pipeline, {fullDocument: "updateLookup"})
        .subscribe({
          next: change => {
            seen.push(change);
            if (seen.length >= expected) {
              subscription.unsubscribe();
              resolve(seen);
            }
          },
          error: reject
        });
      setTimeout(() => {
        subscription.unsubscribe();
        resolve(seen);
      }, timeoutMs);
    });

  it("insert: operationType, ns.coll, documentKey._id, fullDocument", async () => {
    const pending = collect(undefined, 1);
    await new Promise(resolve => setTimeout(resolve, 300));
    await database.collection(COLLECTION).insertOne({_id: oid(40), title: "w"} as any);

    const [change] = await pending;
    expect(change.operationType).toBe("insert");
    expect(change.ns.coll).toBe(COLLECTION);
    expect(String(change.documentKey._id)).toBe(oid(40));
    expect(change.fullDocument.title).toBe("w");
  });

  /**
   * The counterpart : `updatedFields` is **name→value**. Returning a list of names only
   * silently broke functions that write `if (updatedFields.status === "paid")`.
   */
  it("update: updateDescription.updatedFields carries name→value", async () => {
    await database.collection(COLLECTION).insertOne({_id: oid(41), title: "a", views: 1} as any);

    const pending = collect([{$match: {operationType: "update"}}], 1);
    await new Promise(resolve => setTimeout(resolve, 300));
    await database
      .collection(COLLECTION)
      .updateOne({_id: oid(41)} as any, {$set: {views: 42}} as any);

    const [change] = await pending;
    expect(change.operationType).toBe("update");
    expect(change.updateDescription.updatedFields).toEqual({views: 42});
    expect(change.updateDescription.removedFields).toEqual([]);
  });

  it("several operationTypes with a pipeline $in", async () => {
    const pending = collect([{$match: {operationType: {$in: ["insert", "delete"]}}}], 2);
    await new Promise(resolve => setTimeout(resolve, 300));
    const collection = database.collection(COLLECTION);
    await collection.insertOne({_id: oid(42), title: "b"} as any);
    await collection.updateOne({_id: oid(42)} as any, {$set: {title: "c"}} as any);
    await collection.deleteOne({_id: oid(42)} as any);

    const seen = await pending;
    expect(seen.map(c => c.operationType)).toEqual(["insert", "delete"]);
  });

  it("delete: fullDocumentBeforeChange is filled, fullDocument is absent", async () => {
    await database.collection(COLLECTION).insertOne({_id: oid(43), title: "gone"} as any);

    const pending = collect([{$match: {operationType: "delete"}}], 1);
    await new Promise(resolve => setTimeout(resolve, 300));
    await database.collection(COLLECTION).deleteOne({_id: oid(43)} as any);

    const [change] = await pending;
    expect(change.fullDocumentBeforeChange.title).toBe("gone");
    expect(change.fullDocument).toBeUndefined();
  });

  /**
   * `documentKey._id` is an **id**, not the stored text.
   *
   * The outbox keeps `doc_id` as text and the payload used to hand that straight through, so a delete
   * event carried a hex string where Mongo carries an `ObjectId` — and `DatabaseChange.documentId` is
   * declared as an `Id`, so the driver was breaking its own contract. The realtime spec caught it through
   * `toEqual` on a Delete chunk.
   */
  it("documentKey._id comes back as an id, on delete too", async () => {
    const pending = collect(undefined, 2);
    await new Promise(resolve => setTimeout(resolve, 300));

    await database.collection(COLLECTION).insertOne({_id: oid(77), title: "goes away"} as any);
    await database.collection(COLLECTION).deleteOne({_id: oid(77)} as any);

    const changes = await pending;
    const inserted = changes.find(c => c.operationType === "insert");
    const deleted = changes.find(c => c.operationType === "delete");

    expect(isId(inserted.documentKey._id)).toBe(true);
    expect(isId(deleted.documentKey._id)).toBe(true);
    expect(String(deleted.documentKey._id)).toBe(oid(77));
  });

  /** An unsupported pipeline is **not silently ignored**: an unfiltered stream delivers the wrong thing. */
  it("an unrecognized pipeline stage raises", () => {
    const collection = database.collection(COLLECTION);
    expect(() => collection.watch([{$project: {title: 1}}])).toThrow(/pipeline stage/);
    expect(() => collection.watch([{$match: {title: "x"}}])).toThrow(/operationType/);
  });
});

/**
 * The `LISTEN` client is the caller's and callers share one — the test harness shares a single client per
 * process because a client per module exhausts the connections. So a driver instance must leave the client
 * exactly as it found it.
 */
describe("the shared LISTEN client", () => {
  const connect = async () => {
    const client = new Client(
      EXTERNAL_URL
        ? {connectionString: EXTERNAL_URL}
        : {host: "127.0.0.1", port: PORT, user: "postgres", password: "cdc", database: "postgres"}
    );
    await client.connect();
    return client;
  };

  it("stop() removes the handlers it attached", async () => {
    const client = await connect();
    const before = client.listenerCount("notification");

    const changes = new PostgresChangeStream(pool, {listenClient: client});
    await changes.start();
    expect(client.listenerCount("notification")).toBe(before + 1);

    await changes.stop();
    expect(client.listenerCount("notification")).toBe(before);

    await client.end();
  });

  /**
   * `stop()` must **not** `UNLISTEN`: the registration belongs to the connection, so silencing it here
   * silenced every other live driver on the same client — closing one module broke change capture for the
   * rest.
   */
  it("stop() leaves the registration for the other users of the client", async () => {
    const client = await connect();

    const first = new PostgresChangeStream(pool, {listenClient: client});
    const second = new PostgresChangeStream(pool, {listenClient: client});
    await first.start();
    await second.start();

    let notified = 0;
    (second as any).listeners.add(() => notified++);

    await first.stop();

    await pool.query(`SELECT pg_notify('${CHANGES_CHANNEL}', '')`);
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(notified).toBeGreaterThan(0);

    await second.stop();
    await client.end();
  });
});

describe("trigger management", () => {
  it("produces no event after detach and produces them again after attach", async () => {
    for (const trigger of ["spica_changes_row_trg", "spica_changes_notify_trg"]) {
      await pool.query(`DROP TRIGGER IF EXISTS "${trigger}" ON ${BUCKET_SCHEMA}."${COLLECTION}"`);
    }

    let from = await frontier();
    await database.collection(COLLECTION).insertOne({_id: oid(15), title: "silent"} as any);
    expect((await drain(from, {collection: COLLECTION}, 8)).changes).toHaveLength(0);

    for (const statement of compileAttachTriggers(COLLECTION, BUCKET_SCHEMA)) {
      await pool.query(statement.sql);
    }

    from = await frontier();
    await database.collection(COLLECTION).insertOne({_id: oid(16), title: "audible"} as any);
    expect((await drain(from, {collection: COLLECTION})).changes).toHaveLength(1);
  });

  it("attach is idempotent — attaching twice does not double the event", async () => {
    for (let i = 0; i < 3; i++) {
      for (const statement of compileAttachTriggers(COLLECTION, BUCKET_SCHEMA)) {
        await pool.query(statement.sql);
      }
    }

    const from = await frontier();
    await database.collection(COLLECTION).insertOne({_id: oid(17), title: "a"} as any);
    expect((await drain(from, {collection: COLLECTION})).changes).toHaveLength(1);
  });
});

describe("LISTEN/NOTIFY", () => {
  it("one notification per statement — NOT per row", async () => {
    const listener = new Client(
      EXTERNAL_URL
        ? {connectionString: EXTERNAL_URL}
        : {host: "127.0.0.1", port: PORT, user: "postgres", password: "cdc", database: "postgres"}
    );
    await listener.connect();

    let notifications = 0;
    listener.on("notification", n => {
      if (n.channel === CHANGES_CHANNEL) notifications++;
    });
    await listener.query(`LISTEN "${CHANGES_CHANNEL}"`);

    // 50 rows in ONE statement: the row trigger runs 50 times, the notify trigger once.
    const values = Array.from({length: 50}, (_, i) => `('${oid(300000 + i)}', 'bulk')`).join(",");
    await pool.query(
      `INSERT INTO ${BUCKET_SCHEMA}."${COLLECTION}" ("_id", "title") VALUES ${values}`
    );

    await new Promise(resolve => setTimeout(resolve, 600));
    await listener.end();

    expect(notifications).toBe(1);
  }, 60_000);
});

/**
 * Collects `expected` events from a `changes()` subscription.
 *
 * Instead of calling `readRound` by hand it uses the **real subscription path**: the `resumeAfter`
 * logic, the skip decision and the polling loop are only exercised together there.
 */
function collectFrom(token: ResumeToken, expected: number): Promise<DatabaseChange[]> {
  return new Promise((resolve, reject) => {
    const collected: DatabaseChange[] = [];
    const subscription = stream()
      .changes(COLLECTION, {resumeAfter: token})
      .subscribe({
        next: change => {
          collected.push(change);
          if (collected.length >= expected) {
            subscription.unsubscribe();
            resolve(collected);
          }
        },
        error: reject
      });

    setTimeout(() => {
      subscription.unsubscribe();
      resolve(collected);
    }, 8_000);
  });
}
