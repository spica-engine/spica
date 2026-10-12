import {afterAll, beforeAll, describe, expect, it} from "@jest/globals";
import {execFileSync} from "child_process";
import {MongoClient} from "mongodb";
import {Pool} from "pg";
import {Bucket} from "@spica-server/interface-bucket";
import {DatabaseService, getCollection, ObjectId, MongoDatabase} from "@spica-server/database";
import {start} from "@spica-server/database-testing";
// `fromLegacyAst` lives in the driver contract: the `ReadPlan` producer (the bucket read path) uses the
// same bridge, and importing it from the PG package would carry it into Mongo installations (recorded as an
// R note: moving the bridge).
import {fromLegacyAst, ICollection} from "@spica-server/database-driver";
import {
  bucketToTable,
  compileCreateSchemas,
  runIdempotentDdl,
  compileCreateTable,
  PostgresDatabase,
  waitForPostgres
} from "@spica-server/database-postgres";
import {aggregate} from "@spica-server/bucket-expression";
import {parser} from "@spica-server/bucket-expression/src/parser";

/**
 * **The differential harness — the real proof of K-2.**
 *
 * The contract suite shows that each driver behaves correctly *on its own*. This file asks a different
 * question: **does the same CEL expression return the same documents on both drivers?** It could not be
 * written in Phase 3d because there was no PG driver; Phase 4 removed the obstacle.
 *
 * Why a separate test: the "one language, N compilers" claim can only be verified if the output of the two
 * compilers is compared **on the same data**. Both compilers can be "working" on their own and still give
 * different results — `null` behaviour, type coercion, array membership and ordering are the typical
 * sources of that.
 */
const IMAGE = "postgres:16";
const NAME = "spica-differential-pg";
const PORT = 45434;
const EXTERNAL_URL = process.env.POSTGRES_URL;

const COLLECTION = "bucket_67d1a0000000000000000001";

const SCHEMA = {
  _id: "67d1a0000000000000000001" as any,
  title: "Differential",
  description: "",
  primary: "title",
  acl: {read: "true==true", write: "true==true"},
  properties: {
    title: {type: "string"},
    views: {type: "number"},
    published: {type: "boolean"},
    tags: {type: "array", items: {type: "string"}}
  }
} as unknown as Bucket;

/**
 * Fixed `_id`s: the **same** documents are written to both backends and the comparison is made over the set
 * of ids. Using random ids could have hidden a difference.
 */
const DOCUMENTS = [
  {_id: "000000000000000000000001", title: "alpha", views: 10, published: true, tags: ["a", "b"]},
  {_id: "000000000000000000000002", title: "beta", views: 50, published: false, tags: ["b"]},
  {_id: "000000000000000000000003", title: "gamma", views: 50, published: true, tags: []},
  {_id: "000000000000000000000004", title: "delta", views: 100, published: false, tags: ["c"]},
  {_id: "000000000000000000000005", title: "epsilon", views: 0, published: true, tags: ["a", "c"]}
];

let mongoClient: MongoClient;
let mongo: ICollection<any>;
let pool: Pool;
let postgres: ICollection<any>;

beforeAll(async () => {
  mongoClient = await start("standalone");
  const database = new MongoDatabase(mongoClient.db("differential"));
  mongo = getCollection(database, COLLECTION) as any;
  await mongo.deleteMany({});

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
      "POSTGRES_PASSWORD=differential",
      IMAGE
    ]);

    const config = {
      host: "127.0.0.1",
      port: PORT,
      user: "postgres",
      password: "differential",
      database: "postgres"
    };

    /**
     * A single successful `SELECT 1` is not enough: the `postgres` image brings up a temporary server for
     * `initdb` and shuts it down again, the first success can hit that one, and the connection is reset
     * right afterwards. `waitForPostgres` requires consecutive successes.
     */
    await waitForPostgres(config);
    pool = new Pool(config);
  }

  for (const statement of compileCreateSchemas()) await runIdempotentDdl(pool, statement.sql);
  const table = {...bucketToTable(SCHEMA), collection: COLLECTION};
  for (const statement of compileCreateTable(table)) {
    await runIdempotentDdl(pool, statement.sql, statement.params);
  }

  const database2 = new PostgresDatabase(pool, "differential", {
    resolveSchema: name => (name === COLLECTION ? SCHEMA : undefined)
  });
  postgres = database2.collection(COLLECTION);
  await postgres.deleteMany({});

  for (const document of DOCUMENTS) {
    const payload = {...document, _id: new ObjectId(document._id)};
    await mongo.insertOne(payload as any);
    await postgres.insertOne(payload as any);
  }
}, 180_000);

afterAll(async () => {
  await mongoClient?.close().catch(() => {});
  await pool?.end().catch(() => {});
  if (EXTERNAL_URL) return;
  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
}, 60_000);

const ids = (documents: any[]) =>
  documents.map(document => String(document._id)).sort((a, b) => a.localeCompare(b));

/** The Mongo path: CEL → `aggregate(…, "match")` → an `$expr` filter → `find`. */
async function onMongo(cel: string): Promise<string[]> {
  const filter = aggregate(cel, {auth: {}}, "match");
  return ids(await mongo.find(filter as any));
}

/**
 * The PG path: CEL → parser → `fromLegacyAst` → `compileExpression` → `WHERE`.
 *
 * `read()` takes the raw tree and builds the bridge internally; here, **symmetrically** with the Mongo side,
 * only the CEL text is given.
 */
async function onPostgres(cel: string): Promise<string[]> {
  const result = await (postgres as any).read({
    collection: COLLECTION,
    filter: fromLegacyAst(parser.parse(cel))
  });
  return ids(result.data);
}

/** Runs both drivers with the same expression and verifies **their equality** and the expected result together. */
async function expectSame(cel: string, expected: string[]) {
  const [mongoIds, postgresIds] = await Promise.all([onMongo(cel), onPostgres(cel)]);
  expect(postgresIds).toEqual(mongoIds);
  expect(mongoIds).toEqual(expected.sort((a, b) => a.localeCompare(b)));
}

const id = (suffix: number) => `00000000000000000000000${suffix}`;

describe("the same CEL, two drivers, the same result", () => {
  it("a numeric comparison", async () => {
    await expectSame("document.views > 40", [id(2), id(3), id(4)]);
  });

  it("equality", async () => {
    await expectSame("document.views == 50", [id(2), id(3)]);
  });

  it("inequality", async () => {
    await expectSame("document.views != 50", [id(1), id(4), id(5)]);
  });

  it("a boolean field", async () => {
    await expectSame("document.published == true", [id(1), id(3), id(5)]);
  });

  it("text equality", async () => {
    await expectSame('document.title == "beta"', [id(2)]);
  });

  it("logical AND", async () => {
    await expectSame("document.views >= 50 && document.published == false", [id(2), id(4)]);
  });

  it("logical OR", async () => {
    await expectSame('document.views == 0 || document.title == "alpha"', [id(1), id(5)]);
  });

  it("negation", async () => {
    await expectSame("!(document.published == true)", [id(2), id(4)]);
  });

  it("zero is not absence (0 == 0 is true)", async () => {
    await expectSame("document.views == 0", [id(5)]);
  });

  it("array membership — some", async () => {
    await expectSame('some(document.tags, ["a"])', [id(1), id(5)]);
  });

  it("array membership — several candidates", async () => {
    await expectSame('some(document.tags, ["b", "c"])', [id(1), id(2), id(4), id(5)]);
  });

  it("an empty array satisfies no candidate", async () => {
    await expectSame('some(document.tags, ["z"])', []);
  });

  it("every candidate has to be present — every", async () => {
    await expectSame('every(document.tags, ["a", "b"])', [id(1)]);
  });

  it("nested logic plus a comparison", async () => {
    await expectSame(
      '(document.views > 40 && document.published == true) || document.title == "epsilon"',
      [id(3), id(5)]
    );
  });

  it("an expression that matches nothing is empty on both sides", async () => {
    await expectSame("document.views > 1000", []);
  });

  it("an expression that matches everything is complete on both sides", async () => {
    await expectSame("document.views >= 0", [id(1), id(2), id(3), id(4), id(5)]);
  });
});
