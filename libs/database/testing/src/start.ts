import {MongoClient, MongoClientOptions} from "mongodb";
import {MongoMemoryReplSet, MongoMemoryServer} from "mongodb-memory-server";

let uri;

const MONGODB_BINARY_VERSION = "7.0.14";

export async function start(topology: "standalone" | "replset") {
  let mongod: MongoMemoryReplSet | MongoMemoryServer;
  let clientOptions: MongoClientOptions;

  if (topology == "replset") {
    const serverOptions = getReplicaServerOptions();
    mongod = await MongoMemoryReplSet.create(serverOptions);
    clientOptions = getReplicaClientOptions();
  } else {
    const serverOptions = getStandaloneServerOptions();
    mongod = await MongoMemoryServer.create(serverOptions);
    clientOptions = {};
  }

  global.__MONGOINSTANCES = global.__MONGOINSTANCES || [];
  global.__MONGOINSTANCES.push(mongod);

  uri = mongod.getUri() + "&retryWrites=false";

  return MongoClient.connect(uri, clientOptions);
}

export async function connect(connectionUri: string) {
  return MongoClient.connect(connectionUri);
}

export function getConnectionUri() {
  return uri;
}

export function getDatabaseName() {
  return "test";
}

function getReplicaClientOptions(): MongoClientOptions {
  return {
    replicaSet: "testset",
    maxPoolSize: Number.MAX_SAFE_INTEGER
  };
}

function getServerOptions() {
  return {
    binary: {version: MONGODB_BINARY_VERSION},
    journal: false
  };
}

function getStandaloneServerOptions(): any {
  return getServerOptions();
}

function getReplicaServerOptions(): any {
  return {
    ...getServerOptions(),
    replSet: {count: 1, storageEngine: "wiredTiger"}
  };
}
