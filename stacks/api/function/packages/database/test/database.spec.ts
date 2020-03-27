import {database} from "@spica-devkit/database";
import * as mongodb from "mongodb";
import {ObjectId} from "mongodb";

function resetEnvironment() {
  delete process.env.__INTERNAL__SPICA__MONGOURL__;
  delete process.env.__INTERNAL__SPICA__MONGODBNAME__;
}

function setEnvironment() {
  process.env.__INTERNAL__SPICA__MONGOURL__ = "mongodb://notarealserver:27017";
  process.env.__INTERNAL__SPICA__MONGODBNAME__ = "testingdb";
}

describe("database", () => {
  let connectSpy: jasmine.Spy<typeof mongodb.MongoClient.prototype.connect>;
  let isConnectedSpy: jasmine.Spy<typeof mongodb.MongoClient.prototype.isConnected>;
  let dbSpy: jasmine.Spy<typeof mongodb.MongoClient.prototype.db>;
  let collectionSpy: jasmine.Spy<typeof mongodb.Db.prototype.collection>;
  let watchSpy: jasmine.Spy<mongodb.Collection["watch"]>;
  let emitWarningSpy: jasmine.Spy<typeof process.emitWarning>;

  beforeEach(() => {
    emitWarningSpy = spyOn(process, "emitWarning");
    connectSpy = spyOn(mongodb.MongoClient.prototype, "connect");
    isConnectedSpy = spyOn(mongodb.MongoClient.prototype, "isConnected");
    dbSpy = spyOn(mongodb.MongoClient.prototype, "db").and.callFake(() => {
      return ({collection: collectionSpy} as unknown) as mongodb.Db;
    });

    collectionSpy = spyOn(mongodb.Db.prototype, "collection").and.callFake(() => {
      return ({
        watch: watchSpy,
        find: jasmine.createSpy(),
        findOne: jasmine.createSpy(),
        findOneAndUpdate: jasmine.createSpy(),
        findOneAndReplace: jasmine.createSpy(),
        findOneAndDelete: jasmine.createSpy(),
        insertOne: jasmine.createSpy(),
        insertMany: jasmine.createSpy(),
        updateOne: jasmine.createSpy(),
        updateMany: jasmine.createSpy(),
        deleteOne: jasmine.createSpy(),
        deleteMany: jasmine.createSpy()
      } as unknown) as mongodb.Collection;
    });

    watchSpy = jasmine.createSpy("watch");

    resetEnvironment();
  });

  it("it should throw an error if environment variables is missing", async () => {
    await expectAsync(database()).toBeRejectedWith(
      new Error(
        "The <__INTERNAL__SPICA__MONGOURL__> or <__INTERNAL__SPICA__MONGODBNAME__> variables was not given."
      )
    );
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("should try to establish when environment variables are set", async () => {
    setEnvironment();
    const db = await database();
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(isConnectedSpy).toHaveBeenCalledTimes(1);
    expect(dbSpy).toHaveBeenCalledTimes(1);
    expect(dbSpy).toHaveBeenCalledWith("testingdb");
    expect(db).toBeTruthy();
  });

  it("should show a warning message when watch is used", async () => {
    setEnvironment();
    const db = await database();
    const coll = db.collection("test");
    coll.watch();

    expect(emitWarningSpy.calls.mostRecent().args[0]).toBe(
      "It is not advised to use 'watch' under spica/functions environment. I hope that you know what you are doing."
    );
  });

  describe("presence of objectid", () => {
    let coll: mongodb.Collection;
    beforeEach(async () => {
      setEnvironment();
      coll = (await database()).collection("test");
    });

    it("should be checked in find", async () => {
      await coll.find({
        _id: new ObjectId(),
        user: new ObjectId()
      });

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path 'user' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in findOne", async () => {
      await coll.find({
        _id: new ObjectId(),
        user: new ObjectId()
      });

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path 'user' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in findOneAndUpdate", async () => {
      await coll.findOneAndUpdate({user: new ObjectId()}, {$set: {user: new ObjectId()}});

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path '$set.user' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in findOneAndReplace", async () => {
      await coll.findOneAndReplace({user: new ObjectId()}, {user: new ObjectId()});

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path 'user' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in findOneAndDelete", async () => {
      await coll.findOneAndUpdate({user: new ObjectId()}, {user: new ObjectId()});

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path 'user' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in findOneAndReplace", async () => {
      await coll.findOneAndReplace({user: new ObjectId()}, {user: new ObjectId()});

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path 'user' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in insertOne", async () => {
      await coll.insertOne({
        _id: new ObjectId(),
        user: new ObjectId()
      });

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path 'user' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in insertMany", async () => {
      await coll.insertMany([
        {
          _id: new ObjectId(),
          user: new ObjectId()
        },
        {
          _id: new ObjectId(),
          user: new ObjectId()
        }
      ]);

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path '0.user' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path '1.user' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in updateOne", async () => {
      await coll.updateOne({_id: new ObjectId()}, {$set: {test: new ObjectId()}});

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path '$set.test' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in updateMany", async () => {
      await coll.updateMany({_id: new ObjectId()}, {$set: {test: new ObjectId()}});

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path '$set.test' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in deleteOne", async () => {
      await coll.deleteOne({test: new ObjectId()});

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path 'test' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should be checked in deleteMany", async () => {
      await coll.deleteMany({test: new ObjectId()});

      expect(emitWarningSpy).toHaveBeenCalledWith(
        `Property in the document path 'test' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });
  });
});
