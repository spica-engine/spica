import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import * as color from "cli-color/lib/supports-color";
import * as fs from "fs";
import {migrate} from "@spica/migrate/src/migrate";

describe("Version range", () => {
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
        "1.0.0": [__dirname + "/migrations/insert_an_item"],
        "1.5.0": [__dirname + "/migrations/insert_an_item"],
        "2.0.0": [__dirname + "/migrations/insert_an_item"]
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

  it("should show versions", async () => {
    const info = jest.spyOn(console, "info");
    await migrate({
      database,
      console,
      from: "0.0.1",
      to: "2.0.0"
    });
    expect(info).toHaveBeenCalledWith("VERSION: 1.0.0");
    expect(info).toHaveBeenCalledWith("VERSION: 1.5.0");
    expect(info).toHaveBeenCalledWith("VERSION: 2.0.0");
  });

  it("should not include starting version", async () => {
    const info = jest.spyOn(console, "info");
    await migrate({
      database,
      console,
      from: "1.0.0",
      to: "2.0.0"
    });
    expect(
      (await db
        .collection("_test_")
        .find()
        .toArray()).length
    ).toEqual(2);
    expect(info).not.toHaveBeenCalledWith("VERSION: 1.0.0");
  });

  it("should include ending version", async () => {
    const info = jest.spyOn(console, "info");
    await migrate({
      database,
      console,
      from: "1.0.0",
      to: "2.0.0"
    });
    expect(
      (await db
        .collection("_test_")
        .find()
        .toArray()).length
    ).toEqual(2);
    expect(info).toHaveBeenCalledWith("VERSION: 2.0.0");
  });
});
