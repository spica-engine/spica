import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import * as fs from "fs";
import {migrate} from "@spica/migrate/src/migrate";

describe("Fault Tolerance", () => {
  let database: {uri: string; name: string};
  let db: Db;

  beforeAll(() => (process.env.TESTONLY_MIGRATION_LOOKUP_DIR = __dirname));

  beforeEach(async () => {
    fs.writeFileSync(
      __dirname + "/migrations/index.json",
      JSON.stringify({
        "1.0.0": [
          __dirname + "/migrations/insert_an_item",
          __dirname + "/migrations/throw_an_error"
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
