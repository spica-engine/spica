import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import * as fs from "fs";
import {migrate} from "@spica/migrate/src/migrate";

describe("Fault Tolerance", () => {
  let database: {uri: string; name: string};
  let db: Db;
  const indexJsonPath = process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/index.json";

  beforeEach(async () => {
    fs.writeFileSync(
      indexJsonPath,
      JSON.stringify({
        "1.0.0": [
          process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/insert_an_item",
          process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/throw_an_error"
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
  });

  afterEach(() => {
    if (fs.existsSync(indexJsonPath)) {
      fs.unlinkSync(indexJsonPath);
    }
  });

  it("should not commit any changes", async () => {
    await migrate({
      database,
      console,
      from: "0.0.1",
      to: "1.0.0"
    }).catch(e => e);
    expect(
      await db
        .collection("_test_")
        .find()
        .toArray()
    ).toEqual([]);
  });

  it("should report the error", async () => {
    const error = await migrate({
      database,
      console,
      from: "0.0.1",
      to: "1.0.0"
    }).catch(e => e);
    expect(error).toEqual("A filthy error has occurred");
  });
});
