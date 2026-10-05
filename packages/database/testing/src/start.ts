import {MongoClient, MongoClientOptions} from "mongodb";
import {MongoMemoryServer} from "mongodb-memory-server";
import {randomBytes} from "crypto";
import {GenericContainer} from "testcontainers";

let uri;
const MONGODB_BINARY_VERSION = "8.0.4";
const mongoUrl = process.env.MONGODB_URL;

export async function start(topology: "standalone" | "replset") {
  /**
   * A server supplied from outside serves **both** topologies.
   *
   * `jest.global-setup.js` brings one replica set up per process and publishes it here, and CI supplies one
   * the same way. Only `replset` used to take this path, so a `standalone` spec started its own
   * `MongoMemoryServer` — a second mongod next to a perfectly good server, and in CI a binary download on
   * top. A replica set answers everything a standalone spec asks for; the reverse is not true, which is why
   * the shared server is always a replica set.
   */
  if (mongoUrl) {
    uri = mongoUrl;
    return MongoClient.connect(uri, getReplicaClientOptions());
  }

  if (topology === "replset") {
    console.debug("Starting MongoDB replica set using GenericContainer...");
    const container = await new GenericContainer("mongo:8.0.4")
      .withExposedPorts(27017)
      .withCommand(["--replSet", "testset", "--bind_ip_all"])
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(27017);

    uri = `mongodb://${host}:${port}/?directConnection=true&retryWrites=false`;

    const tempClient = await MongoClient.connect(uri);
    await tempClient.db("admin").command({
      replSetInitiate: {
        _id: "testset",
        members: [{_id: 0, host: `localhost:27017`}]
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    await tempClient.close();

    setGlobalCleanups(() => container.stop());

    return MongoClient.connect(uri, getReplicaClientOptions());
  }

  const mongod = await MongoMemoryServer.create({binary: {version: MONGODB_BINARY_VERSION}});

  setGlobalCleanups(() => mongod.stop());

  uri = mongod.getUri() + "&retryWrites=false";

  return MongoClient.connect(uri, {});
}

/**
 * Registers a stop that `jest.setup.js`'s `afterAll` **actually waits for**.
 *
 * It used to push `() => setTimeout(() => stopCallback(), 2000)`. That returns a timer id, not a promise,
 * so the `await Promise.all(...)` in `afterAll` resolved immediately and the stop was merely *scheduled*
 * two seconds out — which never arrived, because the suite runs with `--forceExit` and the process was
 * already gone.
 *
 * The consequence only shows in a **local full run**, and it is severe there: the Mongo leg starts one
 * `mongo:8.0.4` container per spec file, so nothing was ever stopped and the containers piled up.
 * Measured: by project ~70 of 78 there were **42 mongod instances**, the load average was over 14, and
 * container startup passed jest's 30 s hook timeout — which surfaces as `beforeEach` failures in whatever
 * project happens to be running, i.e. it looks like a test defect. A full run went from 105 minutes to
 * not finishing. In CI it stays hidden: the matrix gives every project its own job, so nothing
 * accumulates.
 *
 * The 2 s pause is kept — the connections need a moment to close before the server goes — but it is now
 * awaited rather than fired and forgotten.
 */
function setGlobalCleanups(stopCallback: () => unknown) {
  globalThis.__CLEANUPCALLBACKS = globalThis.__CLEANUPCALLBACKS || [];
  globalThis.__CLEANUPCALLBACKS.push(async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await stopCallback();
  });
}

export async function connect(connectionUri: string) {
  return MongoClient.connect(connectionUri);
}

export function getConnectionUri() {
  return uri;
}

export function getDatabaseName() {
  return generateUniqueDatabaseName();
}

function getReplicaClientOptions(): MongoClientOptions {
  return {
    replicaSet: "testset",
    maxPoolSize: Number.MAX_SAFE_INTEGER,
    directConnection: true,
    retryWrites: false,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000
  };
}

function generateUniqueDatabaseName(): string {
  const base = "test";
  const uniqueSuffix = randomBytes(4).toString("hex");
  return `${base}_${uniqueSuffix}`;
}
