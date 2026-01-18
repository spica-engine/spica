import {
  Db,
  getConnectionUri,
  getDatabaseName,
  ObjectId,
  start
} from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Enable changeStreamPreAndPostImages for collections", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("standalone");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
  });

  it("should enable changeStreamPreAndPostImages for collections", async () => {
    await db.collection("buckets").insertOne({_id: new ObjectId(), name: "test bucket"});
    await db
      .collection("function")
      .insertOne({_id: new ObjectId(), name: "test function", env: {}});
    await db.collection("env_var").insertOne({_id: new ObjectId(), name: "test env var"});
    await db.collection("policies").insertOne({_id: new ObjectId(), name: "test policy"});
    await db.collection("webhooks").insertOne({_id: new ObjectId(), name: "test webhook"});

    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);

    const bucketsInfo = (await db.listCollections({name: "buckets"}).toArray()) as any;
    expect(bucketsInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(true);

    const functionInfo = (await db.listCollections({name: "function"}).toArray()) as any;
    expect(functionInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(true);

    const envVarInfo = (await db.listCollections({name: "env_var"}).toArray()) as any;
    expect(envVarInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(true);

    const policiesInfo = (await db.listCollections({name: "policies"}).toArray()) as any;
    expect(policiesInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(true);

    const webhooksInfo = (await db.listCollections({name: "webhooks"}).toArray()) as any;
    expect(webhooksInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(undefined);
  });

  it("should enable changeStreamPreAndPostImages only for existing collections", async () => {
    await db.collection("buckets").insertOne({_id: new ObjectId(), name: "test bucket"});
    await db
      .collection("function")
      .insertOne({_id: new ObjectId(), name: "test function", env: {}});

    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);

    const bucketsInfo = (await db.listCollections({name: "buckets"}).toArray()) as any;
    expect(bucketsInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(true);

    const functionInfo = (await db.listCollections({name: "function"}).toArray()) as any;
    expect(functionInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(true);

    const envVarInfo = (await db.listCollections({name: "env_var"}).toArray()) as any;
    expect(envVarInfo.length).toBe(0);

    const policiesInfo = (await db.listCollections({name: "policies"}).toArray()) as any;
    expect(policiesInfo.length).toBe(0);
  });
});
