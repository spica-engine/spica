import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database-testing";
import {ObjectId} from "mongodb";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/src");

jest.setTimeout(120_000);

describe("Convert function relation ids to ObjectId", () => {
  let db: Db;
  let args: string[];

  const migrate = () =>
    run([...args, "--from", "0.19.3", "--to", "0.19.4", "--continue-if-versions-are-equal"]);

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
  });

  it("should convert string secret and env var ids to ObjectId", async () => {
    const secretId = new ObjectId();
    const envVarId = new ObjectId();

    await db.collection("function").insertOne({
      name: "fn",
      language: "javascript",
      timeout: 60,
      secrets: [secretId.toHexString()],
      env_vars: [envVarId.toHexString()]
    });

    await migrate();

    const fn = await db.collection("function").findOne({name: "fn"});

    expect(fn.secrets[0]).toBeInstanceOf(ObjectId);
    expect(fn.secrets[0].toHexString()).toEqual(secretId.toHexString());
    expect(fn.env_vars[0]).toBeInstanceOf(ObjectId);
    expect(fn.env_vars[0].toHexString()).toEqual(envVarId.toHexString());
  });

  it("should collapse a string and ObjectId pair of the same id", async () => {
    const secretId = new ObjectId();

    await db.collection("function").insertOne({
      name: "fn",
      language: "javascript",
      timeout: 60,
      secrets: [secretId.toHexString(), secretId]
    });

    await migrate();

    const fn = await db.collection("function").findOne({name: "fn"});

    expect(fn.secrets).toHaveLength(1);
    expect(fn.secrets[0]).toBeInstanceOf(ObjectId);
    expect(fn.secrets[0].toHexString()).toEqual(secretId.toHexString());
  });

  it("should leave already converted documents untouched", async () => {
    const secretId = new ObjectId();
    const envVarId = new ObjectId();

    await db.collection("function").insertOne({
      name: "fn",
      language: "javascript",
      timeout: 60,
      secrets: [secretId],
      env_vars: [envVarId]
    });

    await migrate();

    const fn = await db.collection("function").findOne({name: "fn"});

    expect(fn.secrets).toEqual([secretId]);
    expect(fn.env_vars).toEqual([envVarId]);
  });

  it("should keep values that are not valid ids", async () => {
    const secretId = new ObjectId();

    await db.collection("function").insertOne({
      name: "fn",
      language: "javascript",
      timeout: 60,
      secrets: ["not-an-object-id", secretId.toHexString()]
    });

    await migrate();

    const fn = await db.collection("function").findOne({name: "fn"});

    expect(fn.secrets).toHaveLength(2);
    expect(fn.secrets[0]).toEqual("not-an-object-id");
    expect(fn.secrets[1]).toBeInstanceOf(ObjectId);
  });

  it("should not touch functions without relation fields", async () => {
    await db.collection("function").insertOne({
      name: "fn",
      language: "javascript",
      timeout: 60
    });

    await migrate();

    const fn = await db.collection("function").findOne({name: "fn"});

    expect(fn.secrets).toBeUndefined();
    expect(fn.env_vars).toBeUndefined();
  });

  it("should convert every affected function", async () => {
    const first = new ObjectId();
    const second = new ObjectId();

    await db.collection("function").insertMany([
      {name: "fn1", language: "javascript", timeout: 60, secrets: [first.toHexString()]},
      {name: "fn2", language: "javascript", timeout: 60, env_vars: [second.toHexString()]},
      {name: "fn3", language: "javascript", timeout: 60, secrets: [first]}
    ]);

    await migrate();

    const fns = await db.collection("function").find({}).sort({name: 1}).toArray();

    expect(fns[0].secrets[0]).toBeInstanceOf(ObjectId);
    expect(fns[1].env_vars[0]).toBeInstanceOf(ObjectId);
    expect(fns[2].secrets).toEqual([first]);
  });

  it("should leave no string entries behind", async () => {
    await db.collection("function").insertMany([
      {
        name: "fn1",
        language: "javascript",
        timeout: 60,
        secrets: [new ObjectId().toHexString()],
        env_vars: [new ObjectId().toHexString()]
      },
      {name: "fn2", language: "javascript", timeout: 60, secrets: [new ObjectId()]}
    ]);

    await migrate();

    const remaining = await db.collection("function").countDocuments({
      $or: [
        {secrets: {$elemMatch: {$type: "string"}}},
        {env_vars: {$elemMatch: {$type: "string"}}}
      ]
    });

    expect(remaining).toEqual(0);
  });
});
