import {close, connection, database} from "@spica-devkit/database";
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
  let connectSpy: jest.SpyInstance<void, [callback: mongodb.MongoCallback<mongodb.MongoClient>], any>;
  let closeSpy: jest.SpyInstance<void, [force: boolean, callback: mongodb.MongoCallback<void>], any>;
  let isConnectedSpy: jest.SpyInstance<boolean, [options?: mongodb.MongoClientCommonOption], any>
  let dbSpy: jest.SpyInstance<mongodb.Db, [dbName?: string, options?: mongodb.MongoClientCommonOption], any>;
  let collectionSpy: jest.SpyInstance<any>;
  let watchSpy: jest.Mock<mongodb.Collection["watch"]>;
  let emitWarningSpy: jest.SpyInstance<void, [warning: string | Error, options?: NodeJS.EmitWarningOptions], any>

  beforeEach(() => {
    let connected = false;
    emitWarningSpy = jest.spyOn(process, "emitWarning");
    connectSpy = jest
      .spyOn(mongodb.MongoClient.prototype, "connect")
      .mockImplementation(async () => {
        connected = true;
        return undefined;
      });
    isConnectedSpy = jest
      .spyOn(mongodb.MongoClient.prototype, "isConnected")
      .mockImplementation(() => connected);
    closeSpy = jest.spyOn(mongodb.MongoClient.prototype, "close").mockImplementation(async () => {
      connected = false;
      return undefined;
    });
    dbSpy = jest.spyOn(mongodb.MongoClient.prototype, "db").mockImplementation(() => {
      return ({collection: collectionSpy} as unknown) as mongodb.Db;
    });

    collectionSpy = jest.spyOn(mongodb.Db.prototype, "collection").mockImplementation(() => {
      return ({
        watch: watchSpy,
        find: jest.fn(),
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
        findOneAndReplace: jest.fn(),
        findOneAndDelete: jest.fn(),
        insertOne: jest.fn(),
        insertMany: jest.fn(),
        updateOne: jest.fn(),
        updateMany: jest.fn(),
        deleteOne: jest.fn(),
        deleteMany: jest.fn()
      } as unknown) as mongodb.Collection;
    });

    watchSpy = jest.fn();

    resetEnvironment();
  });

  afterEach( () => {
    emitWarningSpy.mockClear();
    connectSpy.mockClear();
    isConnectedSpy.mockClear();
    closeSpy.mockClear();
    dbSpy.mockClear();
    collectionSpy.mockClear();
    watchSpy.mockClear();
  })

  it("it should throw an error if environment variables is missing", async () => {
    await expect(database()).rejects.toEqual(
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
    expect(isConnectedSpy).toHaveBeenCalled();
    expect(dbSpy).toHaveBeenCalledTimes(1);
    expect(dbSpy).toHaveBeenCalledWith("testingdb");
    expect(db).toBeTruthy();
  });

  it("should show a warning message when watch is used", async () => {
    setEnvironment();
    const db = await database();
    const coll = db.collection("test");
    coll.watch();
    expect(emitWarningSpy.mock.calls[emitWarningSpy.mock.calls.length - 1][0]).toEqual(
      "DeprecationWarning: It is not advised to use 'watch' under spica/functions environment. I hope that you know what you are doing."
    );
  });

  it("should close the connection", async () => {
    setEnvironment();
    const _ = await database();
    expect(!!connection).toBe(true);
    await close();
    expect(!!connection).toBe(false);
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
      await coll.findOne({
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
