import * as fs from "fs";
import {MongoMemoryReplSet} from "mongodb-memory-server-core";
import * as which from "which";
const MONGOD_PATH: string = which.sync("mongod");

fs.writeFileSync(process.env.WORKER_PID_FILE, process.pid);

let timeout = setTimeout(() => process.exit(0), 200000);

fs.watchFile(process.env.WORKER_TEST_PID_FILE, () => {
  clearTimeout(timeout);
  timeout = setTimeout(() => process.exit(0), 20000);
});

const replSet = new MongoMemoryReplSet({
  binary: {
    // @ts-ignore
    systemBinary: MONGOD_PATH
  },
  replSet: {count: 1},
  instanceOpts: [{storageEngine: "wiredTiger"}]
});

replSet
  .waitUntilRunning()
  .then(() => replSet._waitForPrimary())
  .then(() => replSet.getConnectionString())
  .then(connectionString => {
    fs.writeFileSync(process.env.WORKER_CONNECTION_URI_FILE, connectionString);
  });

process.once("exit", () => {
  replSet.stop();
  fs.unlinkSync(process.env.WORKER_PID_FILE);
  fs.unlinkSync(process.env.WORKER_TEST_PID_FILE);
  fs.unlinkSync(process.env.WORKER_CONNECTION_URI_FILE);
});
