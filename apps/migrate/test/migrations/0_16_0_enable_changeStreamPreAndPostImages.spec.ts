import {
  Db,
  getConnectionUri,
  getDatabaseName,
  ObjectId,
  start
} from "@spica-server/database-testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/src");

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

  it("should enable changeStreamPreAndPostImages only for the function_assets collection", async () => {
    await db
      .collection("function_assets")
      .insertOne({_id: new ObjectId(), functionId: new ObjectId(), filename: "index.ts"});
    await db.collection("buckets").insertOne({_id: new ObjectId(), name: "test bucket"});
    await db
      .collection("function")
      .insertOne({_id: new ObjectId(), name: "test function", env: {}});

    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);

    const assetsInfo = (await db.listCollections({name: "function_assets"}).toArray()) as any;
    expect(assetsInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(true);

    const bucketsInfo = (await db.listCollections({name: "buckets"}).toArray()) as any;
    expect(bucketsInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(undefined);

    const functionInfo = (await db.listCollections({name: "function"}).toArray()) as any;
    expect(functionInfo[0].options?.changeStreamPreAndPostImages?.enabled).toBe(undefined);
  });

  it("should skip when the function_assets collection does not exist", async () => {
    await db.collection("buckets").insertOne({_id: new ObjectId(), name: "test bucket"});

    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);

    const assetsInfo = (await db.listCollections({name: "function_assets"}).toArray()) as any;
    expect(assetsInfo.length).toBe(0);
  });
});
