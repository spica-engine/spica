import {MongoClient, MongoClientOptions} from "mongodb";
import {MongoMemoryReplSet, MongoMemoryServer} from "mongodb-memory-server";
import path from "path";
import fs from "fs";

let uri;
let DEFAULT_DB_PATH = fs.mkdtempSync(path.join(process.env.TEST_TMPDIR, "db-"));
let mongod: MongoMemoryReplSet | MongoMemoryServer;

const DEFAULT_MONGODB_BINARY_VERSION = "7.0.14";

export async function start(
  topology: "standalone" | "replset",
  version = DEFAULT_MONGODB_BINARY_VERSION,
  dbPath = DEFAULT_DB_PATH
) {
  let clientOptions: MongoClientOptions;

  if (topology == "replset") {
    const serverOptions = getReplicaServerOptions(version, dbPath);
    mongod = await MongoMemoryReplSet.create(serverOptions);
    clientOptions = getReplicaClientOptions();
  } else {
    const serverOptions = getStandaloneServerOptions(version, dbPath);
    mongod = await MongoMemoryServer.create(serverOptions);
    clientOptions = {};
  }

  globalThis.__CLEANUPCALLBACKS = globalThis.__CLEANUPCALLBACKS || [];
  globalThis.__CLEANUPCALLBACKS.push(() => setTimeout(() => mongod.stop(), 1000));

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

export function stopServer(doCleanup: boolean, force: boolean) {
  return mongod.stop({doCleanup, force});
}

function getReplicaClientOptions(): MongoClientOptions {
  return {
    replicaSet: "testset",
    maxPoolSize: Number.MAX_SAFE_INTEGER
  };
}

function getServerOptions(version: string, dbPath: string) {
  return {
    binary: {version: version},
    instance: {dbPath}
  };
}

function getStandaloneServerOptions(version: string, dbPath: string): any {
  return getServerOptions(version, dbPath);
}

function getReplicaServerOptions(version: string, dbPath: string): any {
  return {
    ...getServerOptions(version, dbPath),
    replSet: {count: 1, storageEngine: "wiredTiger"},
    instanceOpts: [
      {
        dbPath
      }
    ]
  };
}
