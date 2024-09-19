import {MongoClient, MongoClientOptions} from "mongodb";

function generateDbName(): string {
  return `test_${Math.random()
    .toString(36)
    .substring(2, 10)}`;
}

export async function start(topology: "standalone" | "replset") {
  const connectionUri = (topology == "standalone"
    ? require("./standalone.json")
    : require("./replicaset.json")
  ).connectionString;

  const options: MongoClientOptions = {};

  if (topology == "replset") {
    options.replicaSet = "testset";
    options.maxPoolSize = Number.MAX_SAFE_INTEGER;
  }

  return MongoClient.connect(connectionUri, options);
}

export function getConnectionUri() {
  return Promise.resolve(require("./replicaset.json").connectionString);
}

export function getDatabaseName() {
  return generateDbName();
}
