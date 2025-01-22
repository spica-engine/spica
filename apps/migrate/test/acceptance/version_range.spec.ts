import {
  Db,
  getConnectionUri,
  getDatabaseName,
  MongoClient,
  start
} from "@spica-server/database/testing";
import * as color from "cli-color/lib/supports-color";
import * as fs from "fs";
import {migrate} from "@spica/migrate";

describe("Version range", () => {
  let database: {uri: string; name: string};
  let db: Db;
  let infoSpy: jest.SpyInstance;
  const indexJsonPath = process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/index.json";

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    fs.writeFileSync(
      indexJsonPath,
      JSON.stringify({
        "1.0.0": [process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/insert_an_item"],
        "1.5.0": [process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/insert_an_item"],
        "2.0.0": [process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/insert_an_item"]
      })
    );
    const connection = await start("replset");
    database = {
      uri: await getConnectionUri(),
      name: getDatabaseName()
    };
    db = connection.db(database.name);
    await db.createCollection("_test_");

    infoSpy = jest.spyOn(console, "info");
  });

  afterEach(() => {
    if (fs.existsSync(indexJsonPath)) {
      fs.unlinkSync(indexJsonPath);
    }

    infoSpy.mockClear();
  });

  it("should show versions", async () => {
    await migrate({
      database,
      console,
      from: "0.0.1",
      to: "2.0.0"
    });
    expect(infoSpy).toHaveBeenCalledWith("VERSION: 1.0.0");
    expect(infoSpy).toHaveBeenCalledWith("VERSION: 1.5.0");
    expect(infoSpy).toHaveBeenCalledWith("VERSION: 2.0.0");
  });

  it("should not include starting version", async () => {
    await migrate({
      database,
      console,
      from: "1.0.0",
      to: "2.0.0"
    });
    expect((await db.collection("_test_").find().toArray()).length).toEqual(2);
    expect(infoSpy).not.toHaveBeenCalledWith("VERSION: 1.0.0");
  });

  it("should include ending version", async () => {
    await migrate({
      database,
      console,
      from: "1.0.0",
      to: "2.0.0"
    });
    expect((await db.collection("_test_").find().toArray()).length).toEqual(2);
    expect(infoSpy).toHaveBeenCalledWith("VERSION: 2.0.0");
  });
});
