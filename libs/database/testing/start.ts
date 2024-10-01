import {MongoClient, MongoClientOptions} from "mongodb";
import {generateDbName} from "mongodb-memory-server-core/lib/util/db_util";

export async function start(topology: "standalone" | "replset") {
  const connectionUri = (topology == "standalone"
    ? require("./standalone.json")
    : require("./replicaset.json")
  ).connectionString;

  const options: MongoClientOptions = {
    useNewUrlParser: true,
    ["useUnifiedTopology" as string]: true
  };

  if (topology == "replset") {
    options.replicaSet = "testset";
    options.poolSize = Number.MAX_SAFE_INTEGER;
  }

  return MongoClient.connect(connectionUri, options);
}

export function getConnectionUri() {
  return Promise.resolve(require("./replicaset.json").connectionString);
}

export function getDatabaseName() {
  return generateDbName();
}
