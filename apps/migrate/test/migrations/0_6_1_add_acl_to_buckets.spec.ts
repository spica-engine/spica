import {Db, getConnectionUri, getDatabaseName, start} from "../../../../libs/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Add acl to buckets", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
    await db.collection("buckets").insertMany([{}, {}]);
  });

  it("should acl to buckets", async () => {
    await run([...args, "--from", "0.6.0", "--to", "0.6.1", "--continue-if-versions-are-equal"]);
    const buckets = (await db.collection("buckets").find({}).toArray()).map(bkt => ({
      acl: bkt.acl
    }));

    expect(buckets).toEqual([
      {acl: {write: "true==true", read: "true==true"}},
      {acl: {write: "true==true", read: "true==true"}}
    ]);
  });
});
