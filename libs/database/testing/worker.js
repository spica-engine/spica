const worker = require("@bazel/worker");
const fs = require("fs");
const {MongoMemoryReplSet, MongoMemoryServer} = require("mongodb-memory-server-core");
const which = require("which");

const MONGOD_PATH = which.sync("mongod");

let replicaSet;

async function runReplicaSet() {
  replicaSet =
    replicaSet ||
    new MongoMemoryReplSet({
      binary: {
        systemBinary: MONGOD_PATH
      },
      replSet: {count: 1},
      instanceOpts: [{storageEngine: "wiredTiger", port: 27020}]
    });

  return replicaSet
    .waitUntilRunning()
    .then(() => replicaSet._waitForPrimary())
    .then(() => replicaSet.getConnectionString());
}

let standalone;

async function runStandalone() {
  standalone =
    standalone ||
    new MongoMemoryServer({
      binary: {
        // @ts-ignore
        systemBinary: MONGOD_PATH
      }
    });
  return standalone.ensureInstance().then(() => standalone.getConnectionString());
}

async function runMongod(args, inputs) {
  const [output, type] = args;
  return (type == "replicaset" ? runReplicaSet() : runStandalone())
    .then(connectionString => {
      fs.writeFileSync(output, JSON.stringify({connectionString: connectionString}));
      return true;
    })
    .catch(error => {
      worker.log(error);
      return false;
    });
}

if (require.main === module) {
  if (worker.runAsWorker(process.argv)) {
    worker.runWorkerLoop(runMongod);
  } else {
    console.error(
      "Running as a standalone process but DatabaseCompile has to run as a worker. try --strategy=DatabaseCompile=worker"
    );
  }
}
