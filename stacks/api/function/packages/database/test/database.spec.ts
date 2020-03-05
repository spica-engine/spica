import {database} from "@spica-devkit/database";
import * as mongodb from "mongodb";

const env = {...process.env};

function resetEnvironment() {
  process.env = env;
}

describe("database", () => {
  let mongoClientSpy: jasmine.SpyObj<mongodb.MongoClient>;
  let dbSpy: jasmine.SpyObj<mongodb.Db>;
  let collectionSpy: jasmine.SpyObj<mongodb.Collection>;
  let emitWarningSpy: jasmine.Spy<typeof process.emitWarning>;

  beforeEach(() => {
    emitWarningSpy = spyOn(process, "emitWarning").and.callThrough();
    mongoClientSpy = jasmine.createSpyObj("MongoClient", [
      "connect",
      "isConnected",
      "db",
      "constructor"
    ]);
    dbSpy = jasmine.createSpyObj("Db", ["collection"]);
    collectionSpy = jasmine.createSpyObj("Collection", ["watch"]);

    mongoClientSpy.db.and.returnValue(dbSpy);

    dbSpy.collection.and.returnValue(collectionSpy);

    spyOn(mongodb, "Db").and.returnValue(dbSpy);
    spyOn(mongodb, "MongoClient").and.returnValue(mongoClientSpy);

    resetEnvironment();
  });

  it("it should throw an error if environment variables is missing", () => {
    expectAsync(database()).toBeRejectedWith(
      "The <__INTERNAL__SPICA__MONGOURL__> or <__INTERNAL__SPICA__MONGODBNAME__> variables was not given."
    );
    expect(mongoClientSpy.connect).not.toHaveBeenCalled();
  });

  it("should try to establish when environment variables are set", async () => {
    process.env.__INTERNAL__SPICA__MONGOURL__ = "mongodb://notarealserver:27017";
    process.env.__INTERNAL__SPICA__MONGODBNAME__ = "testingdb";
    const db = await database();
    expect(mongoClientSpy.connect).toHaveBeenCalledTimes(1);
    expect(mongoClientSpy.isConnected).toHaveBeenCalledTimes(1);
    expect(mongoClientSpy.db).toHaveBeenCalledTimes(1);
    expect(mongoClientSpy.db).toHaveBeenCalledWith("testingdb");
    expect(db).toBeTruthy();
  });

  it("should show a warning message when watch is used", async () => {
    process.env.__INTERNAL__SPICA__MONGOURL__ = "mongodb://notarealserver:27017";
    process.env.__INTERNAL__SPICA__MONGODBNAME__ = "testingdb";
    const db = await database();
    const coll = db.collection("test");
    coll.watch();

    expect(emitWarningSpy.calls.mostRecent().args[0]).toBe(
      "It is not advised to use 'watch' under spica/functions environment. I hope that you know what you are doing."
    );
  });
});
