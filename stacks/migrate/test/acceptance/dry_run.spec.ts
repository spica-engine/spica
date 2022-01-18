import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import * as color from "cli-color/lib/supports-color";
import * as fs from "fs";
import {migrate} from "@spica/migrate/src/migrate";

describe("DRY Run", () => {
  let database: {uri: string; name: string};
  let db: Db;

  beforeAll(() => {
    process.env.TESTONLY_MIGRATION_LOOKUP_DIR = __dirname;
    color.disableColor();
  });

  beforeEach(async () => {
    fs.writeFileSync(
      __dirname + "/migrations/index.json",
      JSON.stringify({
        "1.0.0": [
          __dirname + "/migrations/insert_an_item",
          __dirname + "/migrations/modify_an_item"
        ]
      })
    );
    const connection = await start("replset");
    database = {
      uri: await getConnectionUri(),
      name: getDatabaseName()
    };
    db = connection.db(database.name);
    await db.createCollection("_test_");
  }, 10000);

  afterEach(() => {
    fs.unlinkSync(__dirname + "/migrations/index.json");
  });

  it("should complete the migration but not commit anything", async () => {
    await migrate({
      database,
      console,
      dryRun: true,
      from: "0.0.1",
      to: "1.0.0"
    });
    const items = await db
      .collection("_test_")
      .find()
      .toArray();
    expect(items.length).toBe(0);
  });

  it("should complete and report to console", async () => {
    const info = spyOn(console, "info");
    await migrate({
      database,
      console,
      dryRun: true,
      from: "0.0.1",
      to: "1.0.0"
    });
    expect(info).toHaveBeenCalledWith(
      "Migration was successful but no changes were made due to --dry-run flag."
    );
  });
});
