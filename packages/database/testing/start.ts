import * as child_process from "child_process";
import * as fs from "fs";
import * as lockfile from "lockfile";
import {MongoClient} from "mongodb";
import {generateDbName} from "mongodb-memory-server-core/lib/util/db_util";
import * as path from "path";

const DEBUG = false;

let WORKER_PWD: string;
let WORKER_LOCK: string;
let WORKER_PID_FILE: string;
let WORKER_TEST_PID_FILE: string;
let WORKER_CONNECTION_URI_FILE: string;
let __CONNECTION_URI__: string;

let inprogress = false;

export async function start(topology: "standalone" | "replset") {
  DEBUG && console.time("START");
  if (topology == "standalone") {
    throw new Error("Topology 'standalone' is not supported yet.");
  }

  if (__CONNECTION_URI__) {
    return getConnection(__CONNECTION_URI__);
  }

  if (inprogress) {
    throw new Error("Another start call is in progress");
  }

  inprogress = true;

  if (!WORKER_PWD) {
    WORKER_PWD = path.join("/tmp", topology);
    fs.mkdirSync(WORKER_PWD, {recursive: true});

    WORKER_LOCK = path.join(WORKER_PWD, "worker.lock");
    WORKER_PID_FILE = path.join(WORKER_PWD, "worker.pid");
    WORKER_TEST_PID_FILE = path.join(WORKER_PWD, "test.pid");
    WORKER_CONNECTION_URI_FILE = path.join(WORKER_PWD, "uri");

    setInterval(() => fs.writeFileSync(WORKER_TEST_PID_FILE, process.pid), 3000);
  }

  let cp: child_process.ChildProcess;

  if (!fs.existsSync(WORKER_PID_FILE)) {
    DEBUG && console.time("LOCK");
    await new Promise((resolve, reject) => {
      lockfile.lock(
        WORKER_LOCK,
        {
          retries: 2,
          retryWait: 300
        },
        async (err: Error) => {
          if (err && err["code"] != "EEXIST") {
            return reject(err);
          }
          resolve();
        }
      );
    });
    DEBUG && console.timeEnd("LOCK");

    if (!fs.existsSync(WORKER_PID_FILE)) {
      cp = child_process.spawn("node", [__dirname + "/worker.js"], {
        cwd: WORKER_PWD,
        detached: true,
        env: {
          ...process.env,
          WORKER_PID_FILE,
          WORKER_TEST_PID_FILE,
          WORKER_CONNECTION_URI_FILE
        },
        stdio: "inherit"
      });
      cp.unref();
    }
  }

  DEBUG && console.time("WORKER_CONNECTION_URI_FILE");
  await checkIfExists(WORKER_CONNECTION_URI_FILE, 6000);
  DEBUG && console.timeEnd("WORKER_CONNECTION_URI_FILE");

  DEBUG && console.time("READ_WORKER_CONNECTION_URI_FILE");
  const connectionUri = (__CONNECTION_URI__ = fs
    .readFileSync(WORKER_CONNECTION_URI_FILE)
    .toString());
  DEBUG && console.timeEnd("READ_WORKER_CONNECTION_URI_FILE");

  inprogress = false;
  DEBUG && console.timeEnd("START");
  return getConnection(connectionUri);
}

export function getDatabaseName() {
  return generateDbName();
}

export function getConnectionUri() {
  return Promise.resolve(__CONNECTION_URI__);
}

function getConnection(connectionUri: string) {
  DEBUG && console.time("CONNECT");
  return MongoClient.connect(connectionUri, {
    replicaSet: "testset",
    poolSize: Number.MAX_SAFE_INTEGER,
    useNewUrlParser: true
  }).then(c => {
    DEBUG && console.timeEnd("CONNECT");
    return c;
  });
}

function checkIfExists(_path_: string, timeout: number) {
  return new Promise((resolve, reject) => {
    const _timeout = setTimeout(() => {
      watcher.close();
      reject(new Error("File did not exists and was not created during the timeout."));
    }, timeout);

    fs.access(_path_, fs.constants.R_OK, err => {
      if (!err) {
        clearTimeout(_timeout);
        watcher.close();
        resolve();
      }
    });

    const directory = path.dirname(_path_);
    const basename = path.basename(_path_);
    const watcher = fs.watch(directory, (eventType, filename) => {
      if (eventType == "rename" && filename == basename) {
        clearTimeout(_timeout);
        watcher.close();
        resolve();
      }
    });
  });
}
