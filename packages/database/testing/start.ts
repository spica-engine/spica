import * as child_process from "child_process";
import * as fs from "fs";
import * as lockfile from "lockfile";
import {MongoClient} from "mongodb";
import {generateDbName} from "mongodb-memory-server-core/lib/util/db_util";
import * as path from "path";

let WORKER_PWD: string;
let WORKER_LOCK: string;
let WORKER_PID_FILE: string;
let WORKER_TEST_PID_FILE: string;
let WORKER_CONNECTION_URI_FILE: string;

let __CONNECTION_URI__: string;

export function start(topology: "standalone" | "replset") {
  return new Promise<MongoClient>((resolve, reject) => {
    if (topology == "standalone") {
      return reject(new Error("Topology 'standalone' is not supported yet."));
    }
    if (__CONNECTION_URI__) {
      return resolve(getConnection(__CONNECTION_URI__));
    }
    if (!WORKER_PWD) {
      WORKER_PWD = path.join("/tmp", topology);
      fs.mkdirSync(WORKER_PWD, {recursive: true});

      WORKER_LOCK = path.join(WORKER_PWD, "worker.lock");
      WORKER_PID_FILE = path.join(WORKER_PWD, "worker.pid");
      WORKER_TEST_PID_FILE = path.join(WORKER_PWD, "test.pid");
      WORKER_CONNECTION_URI_FILE = path.join(WORKER_PWD, "uri");

      setInterval(() => fs.writeFileSync(WORKER_TEST_PID_FILE, process.pid), 3000);
    }

    if (!fs.existsSync(WORKER_PID_FILE)) {
      lockfile.lock(
        WORKER_LOCK,
        {
          retries: 1000,
          wait: 1000
        },
        err => {
          if (err) {
            return reject(err);
          }
          if (!fs.existsSync(WORKER_PID_FILE)) {
            const cp = child_process.spawn("node", [__dirname + "/worker.js"], {
              cwd: WORKER_PWD,
              detached: true,
              env: {
                ...process.env,
                WORKER_PID_FILE,
                WORKER_TEST_PID_FILE,
                WORKER_CONNECTION_URI_FILE
              },
              stdio: "ignore"
            });
            cp.unref();
          }
        }
      );
    }

    const getConnectionUri = () => {
      const connectionUri = (__CONNECTION_URI__ = fs
        .readFileSync(WORKER_CONNECTION_URI_FILE)
        .toString());
      resolve(getConnection(connectionUri));
    };
    if (fs.existsSync(WORKER_CONNECTION_URI_FILE)) {
      getConnectionUri();
    } else {
      fs.watchFile(WORKER_CONNECTION_URI_FILE, {persistent: false}, curr => {
        if (curr.isFile()) {
          fs.unwatchFile(WORKER_CONNECTION_URI_FILE);
          getConnectionUri();
        }
      });
    }
  });
}
export function getDatabaseName() {
  return generateDbName();
}

export function getConnectionUri() {
  return Promise.resolve(__CONNECTION_URI__);
}

function getConnection(connectionUri: string) {
  return MongoClient.connect(connectionUri, {
    replicaSet: "testset",
    poolSize: Number.MAX_SAFE_INTEGER,
    useNewUrlParser: true
  });
}
