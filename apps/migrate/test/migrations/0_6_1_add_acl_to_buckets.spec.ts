import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import * as color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate/src/main";

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
    const buckets = (await db
      .collection("buckets")
      .find({})
      .toArray()).map(bkt => ({acl: bkt.acl}));

    expect(buckets).toEqual([
      {acl: {write: "true==true", read: "true==true"}},
      {acl: {write: "true==true", read: "true==true"}}
    ]);
  });
});
