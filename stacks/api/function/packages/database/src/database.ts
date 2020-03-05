import * as mongodb from "mongodb";
import * as util from "util";

let connection: mongodb.MongoClient;

function checkEnvironment() {
  if (!process.env.RUNTIME) {
    console.warn(
      `Seems like you are not under spica/functions environment.` +
        `This module is only designed to work with spica/functions.`
    );
  }

  const {
    __INTERNAL__SPICA__MONGOURL__: url,
    __INTERNAL__SPICA__MONGODBNAME__: dbName
  } = process.env;

  if (!url || !dbName) {
    throw new Error(
      `The <__INTERNAL__SPICA__MONGOURL__> or <__INTERNAL__SPICA__MONGODBNAME__> variables was not given.`
    );
  }
}

async function connect(): Promise<mongodb.MongoClient> {
  if (!connection) {
    connection = new mongodb.MongoClient(process.env.__INTERNAL__SPICA__MONGOURL__, {
      replicaSet: process.env.__INTERNAL__SPICA__MONGOREPL__,
      appname: `Functions on ${process.env.RUNTIME || "unknown"} runtime.`,
      useNewUrlParser: true
    });
  }
  if (!connection.isConnected()) {
    await connection.connect();
  }
  return connection;
}

export async function database(): Promise<mongodb.Db> {
  checkEnvironment();

  const connection = await connect();
  process.emitWarning(
    `As the structure of the data in the database is subject to change in any future release, we encourage you not to interact with the database directly.\n` +
      `Alternatively, we recommend you to use APIs with an API Key to accomplish same thing.`,
    "ExpermintalWarning"
  );

  const db = connection.db(process.env.__INTERNAL__SPICA__MONGODBNAME__);

  const collection = db.collection;

  db.collection = (...args) => {
    const coll: mongodb.Collection = collection.call(db, ...args);
    coll.watch = util.deprecate(
      coll.watch,
      `It is not advised to use 'watch' under spica/functions environment. I hope that you know what you are doing.`
    );
    return coll;
  };

  return db;
}
