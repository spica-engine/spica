import {checkDocument, checkDocuments} from "./check";
import {mongodb, _mongodb} from "./mongo";
import {ObjectId} from "./objectid";

process.once("SIGTERM", () => {
  const closeRes = close(false);
  closeRes instanceof Promise ? closeRes.then(() => process.exit()) : process.exit();
});

let connection: _mongodb.MongoClient = globalThis[Symbol.for("kDatabaseDevkitConn")];

function ignoreWarnings() {
  return "NO_DEVKIT_DATABASE_WARNING" in process.env;
}

function checkEnvironment() {
  if (!process.env.RUNTIME) {
    process.emitWarning(
      `Seems like you are not under spica/functions environment.` +
        `This module is only designed to work with spica/functions.`
    );
  }

  const {__INTERNAL__SPICA__MONGOURL__: url, __INTERNAL__SPICA__MONGODBNAME__: dbName} =
    process.env;

  if (!url || !dbName) {
    throw new Error(
      `The <__INTERNAL__SPICA__MONGOURL__> or <__INTERNAL__SPICA__MONGODBNAME__> variables was not given.`
    );
  }
}

async function connect(): Promise<_mongodb.MongoClient> {
  if (!connection) {
    connection = new mongodb.MongoClient(process.env.__INTERNAL__SPICA__MONGOURL__, {
      replicaSet: process.env.__INTERNAL__SPICA__MONGOREPL__,
      appName: `Functions on ${process.env.RUNTIME || "unknown"} runtime.`
    });
  }
  await connection.connect();
  return connection;
}

const wrappedCollectionsMap = new WeakMap<_mongodb.Db, Map<string, _mongodb.Collection<any>>>();

export async function database(): Promise<_mongodb.Db> {
  checkEnvironment();

  const connection = (globalThis[Symbol.for("kDatabaseDevkitConn")] = await connect());

  if (!ignoreWarnings() && "TIMEOUT" in process.env) {
    process.emitWarning(
      `As the structure of the data in the database is subject to change in any future release, we encourage you not to interact with the database directly.\n` +
        `As an alternative, we recommend you to interact with the APIs through an API Key to do the same. \n` +
        `Set NO_DEVKIT_DATABASE_WARNING environment variable to ignore this warning.`,
      "FootgunWarning"
    );
  }

  const db = connection.db(process.env.__INTERNAL__SPICA__MONGODBNAME__);

  const originalCollection = db.collection.bind(db);

  if (!wrappedCollectionsMap.has(db)) {
    wrappedCollectionsMap.set(db, new Map());
  }
  const collectionCache = wrappedCollectionsMap.get(db);

  db.collection = (...args) => {
    const collectionName = args[0];

    if (collectionCache.has(collectionName)) {
      return collectionCache.get(collectionName);
    }

    const coll: _mongodb.Collection<any> = originalCollection(...args);
    collectionMethods(coll);
    collectionCache.set(collectionName, coll);

    return coll;
  };

  return db;
}

function collectionMethods(coll: _mongodb.Collection<any>): void {
  const watch = coll.watch;
  coll.watch = (...args) => {
    process.emitWarning(
      "DeprecationWarning: It is not advised to use 'watch' under spica/functions environment. I hope that you know what you are doing."
    );
    return watch.bind(coll)(...args);
  };
  const findById = coll.findOne;
  coll["findById"] = (id, ...args) => {
    const objectId = new ObjectId(id);
    return findById.bind(coll)({_id: objectId}, ...args);
  };

  const findOne = coll.findOne;
  coll.findOne = (filter?, ...args) => {
    validateDocs(filter);
    return findOne.bind(coll)(filter, ...args);
  };
  const find = coll.find;
  coll.find = (filter?, ...args) => {
    validateDocs(filter);
    return find.bind(coll)(filter, ...args);
  };
  const findOneAndUpdate = coll.findOneAndUpdate;
  coll.findOneAndUpdate = (filter, update, ...args) => {
    validateDocs(filter);
    validateDocs(update);
    return findOneAndUpdate.bind(coll)(filter, update, ...args);
  };

  const findOneAndReplace = coll.findOneAndReplace;
  coll.findOneAndReplace = (filter, update, ...args) => {
    validateDocs(filter);
    validateDocs(update);
    return findOneAndReplace.bind(coll)(filter, update, ...args);
  };

  const findOneAndDelete = coll.findOneAndDelete;
  coll.findOneAndDelete = (filter, ...args) => {
    validateDocs(filter);
    return findOneAndDelete.bind(coll)(filter, ...args);
  };

  const insertOne = coll.insertOne;
  coll.insertOne = (doc, ...args) => {
    validateDocs(doc);
    return insertOne.bind(coll)(doc, ...args);
  };
  const insertMany = coll.insertMany;
  coll.insertMany = (docs, ...args) => {
    validateDocs(docs);
    return insertMany.bind(coll)(docs, ...args);
  };
  const updateOne = coll.updateOne;
  coll.updateOne = (filter, update, ...args) => {
    validateDocs(filter);
    validateDocs(update);
    return updateOne.bind(coll)(filter, update, ...args);
  };

  const updateMany = coll.updateMany;
  coll.updateMany = (filter, update, ...args) => {
    validateDocs(filter);
    validateDocs(update);
    return updateMany.bind(coll)(filter, update, ...args);
  };

  const deleteOne = coll.deleteOne;
  coll.deleteOne = (filter, ...args) => {
    validateDocs(filter);
    return deleteOne.bind(coll)(filter, ...args);
  };

  const deleteMany = coll.deleteMany;
  coll.deleteMany = (filter, ...args) => {
    validateDocs(filter);
    return deleteMany.bind(coll)(filter, ...args);
  };
}

function validateDocs(doc: object | object[]) {
  if (!ignoreWarnings()) {
    Array.isArray(doc) ? checkDocuments(doc) : checkDocument(doc);
  }
}

export function close(force?: boolean): Promise<void> | void {
  if (connection) {
    const closed = connection.close(force);
    connection = globalThis[Symbol.for("kDatabaseDevkitConn")] = undefined;
    return closed;
  }
  return Promise.resolve();
}

export function isConnected() {
  return !!connection;
}
