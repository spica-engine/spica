import {database, isConnected, close} from "@spica-devkit/database";
import {start, getConnectionUri, getDatabaseName} from "../../../../../../../libs/database/testing";
import {Db} from "mongodb";

describe("Database e2e", () => {
  beforeEach(async () => {
    await start("standalone");
    process.env.__INTERNAL__SPICA__MONGOURL__ = await getConnectionUri();
    process.env.__INTERNAL__SPICA__MONGODBNAME__ = getDatabaseName();
  });

  it("should connect to database", async () => {
    const db = await database();

    expect(db instanceof Db).toBe(true);
    expect(isConnected()).toBe(true);
  });

  it("should close the connection to the database", async () => {
    const _ = await database();
    expect(isConnected()).toBe(true);
    await close();
    expect(isConnected()).toBe(false);
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

  it("should find by id", async () => {
    const db = await database();
    const coll = db.collection("test");

    const {insertedId} = await coll.insertOne({
      test: 1
    });

    let data = await coll["findById"](insertedId);
    expect(data).toEqual({
      _id: insertedId,
      test: 1
    });

    data = await coll["findById"](insertedId.toHexString());
    expect(data).toEqual({
      _id: insertedId,
      test: 1
    });
  });
});
