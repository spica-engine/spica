import * as fs from "fs";
import {MongoMemoryReplSet} from "mongodb-memory-server-core";
import * as which from "which";

const MONGOD_PATH: string = which.sync("mongod");

fs.promises.writeFile(process.env.WORKER_PID_FILE, process.pid);

const replSet = new MongoMemoryReplSet({
  binary: {
    // @ts-ignore
    systemBinary: MONGOD_PATH
  },
  replSet: {count: 1},
  instanceOpts: [{storageEngine: "wiredTiger", port: 27020}]
});

replSet
  .waitUntilRunning()
  .then(() => replSet._waitForPrimary())
  .then(() => replSet.getConnectionString())
  .then(connectionString => {
    fs.writeFileSync(process.env.WORKER_CONNECTION_URI_FILE, connectionString);
  });

const INTERVAL = 120000;

let timeout = setTimeout(() => process.exit(0), INTERVAL);

fs.watchFile(process.env.WORKER_TEST_PID_FILE, () => {
  clearTimeout(timeout);
  timeout = setTimeout(() => process.exit(0), INTERVAL);
});

process.once("exit", () => {
  fs.unlinkSync(process.env.WORKER_CONNECTION_URI_FILE);
  fs.unlinkSync(process.env.WORKER_PID_FILE);
  fs.unlinkSync(process.env.WORKER_TEST_PID_FILE);
});
