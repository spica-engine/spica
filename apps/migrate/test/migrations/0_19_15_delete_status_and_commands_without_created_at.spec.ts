import {
  Db,
  ObjectId,
  getConnectionUri,
  getDatabaseName,
  start
} from "@spica-server/database-testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/src");

jest.setTimeout(120_000);

describe("Delete status and commands without created_at", () => {
  let db: Db;
  let args: string[];
  const migrationArgs = [
    "--from",
    "0.19.14",
    "--to",
    "0.19.15",
    "--continue-if-versions-are-equal"
  ];

  const idAt = (secondsAgo: number) =>
    ObjectId.createFromTime(Math.floor(Date.now() / 1000) - secondsAgo);

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
  });

  it("should delete documents without created_at and keep the ones that have it", async () => {
    const legacyStatus = [
      {_id: idAt(7200), count: 1},
      {_id: idAt(3600), count: 2}
    ];
    const legacyCommands = [
      {_id: idAt(7200), source: {}},
      {_id: idAt(60), source: {}}
    ];
    const currentStatus = {_id: idAt(3600), count: 3, created_at: new Date()};
    const currentCommand = {_id: idAt(60), source: {}, created_at: new Date()};

    await db.collection("status").insertMany([...legacyStatus, currentStatus]);
    await db.collection("commands").insertMany([...legacyCommands, currentCommand]);

    await run([...args, ...migrationArgs]);

    expect(await db.collection("status").find().toArray()).toEqual([currentStatus]);
    expect(await db.collection("commands").find().toArray()).toEqual([currentCommand]);
  });

  it("should delete more documents than a single batch", async () => {
    const docs = Array.from({length: 12_000}, (_, i) => ({_id: idAt(7200 + i), count: i}));
    await db.collection("status").insertMany(docs);

    await run([...args, ...migrationArgs]);

    expect(await db.collection("status").countDocuments()).toBe(0);
  });

  it("should not touch other collections", async () => {
    await db.collection("jobs").insertOne({_id: "job-1" as any});

    await run([...args, ...migrationArgs]);

    expect(await db.collection("jobs").countDocuments()).toBe(1);
  });

  it("should not delete anything when --dry-run is set", async () => {
    await db.collection("status").insertOne({_id: idAt(7200), count: 1});
    await db.collection("commands").insertOne({_id: idAt(7200), source: {}});

    await run([...args, ...migrationArgs, "--dry-run"]);

    expect(await db.collection("status").countDocuments()).toBe(1);
    expect(await db.collection("commands").countDocuments()).toBe(1);
  });
});
