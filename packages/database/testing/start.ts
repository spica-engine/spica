import {MongoClient, MongoClientOptions} from "mongodb";
import {MongoMemoryReplSet, MongoMemoryServer} from "mongodb-memory-server";

let uri;

export async function start(topology: "standalone" | "replset") {
  let mongod: MongoMemoryReplSet | MongoMemoryServer;
  let options = getOptions();

  if (topology == "replset") {
    mongod = await MongoMemoryReplSet.create({
      replSet: {count: 1, storageEngine: "wiredTiger"},
      binary: {version: "5.0.19"}
    });

    options.replicaSet = "testset";
    options.poolSize = Number.MAX_SAFE_INTEGER;
  } else {
    mongod = await MongoMemoryServer.create({
      binary: {version: "5.0.19"}
    });
  }

  uri = mongod.getUri() + "&retryWrites=false";

  return MongoClient.connect(uri, options);
}

export async function connect(connectionUri: string) {
  return MongoClient.connect(connectionUri, getOptions());
}

export function getConnectionUri() {
  return uri;
}

export function getDatabaseName() {
  return "test";
}

function getOptions(): MongoClientOptions {
  return {
    useNewUrlParser: true,
    ["useUnifiedTopology" as string]: true
  };
}
