import {database, connected, close} from "@spica-devkit/database";
import {start, getConnectionUri, getDatabaseName} from "@spica-server/database/testing";
import {Db} from "mongodb";

describe("Database e2e", () => {
  beforeEach(async () => {
    const db = await start("standalone");
    process.env.__INTERNAL__SPICA__MONGOURL__ = await getConnectionUri();
    process.env.__INTERNAL__SPICA__MONGODBNAME__ = getDatabaseName();
  });

  it("should connect to database", async () => {
    const db = await database();

    expect(db instanceof Db).toBe(true);
    expect(await connected()).toBe(true);
  });

  it("should close the connection to the database", async () => {
    const _ = await database();
    expect(connected()).toBe(true);
    await close();
    expect(connected()).toBe(false);
  });

  it("should write to database", async () => {
    const db = await database();
    const coll = db.collection("test");
    let data = await coll.find({}).toArray();
    expect(data.length).toBe(0);
    await coll.insertOne({
      test: 1
    });
    data = await coll.find({}).toArray();
    expect(data.length).toBe(1);
    expect(db instanceof Db).toBe(true);
  });
});
