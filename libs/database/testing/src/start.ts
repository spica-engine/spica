import {MongoClient, MongoClientOptions} from "mongodb";
import {MongoMemoryReplSet, MongoMemoryServer} from "mongodb-memory-server";
import {randomBytes} from "crypto";
import {GenericContainer} from "testcontainers";

let uri;
const MONGODB_BINARY_VERSION = "7.0.14";
const mongoUrl = process.env.MONGODB_URL;

export async function start(topology: "standalone" | "replset") {
  let mongod: MongoMemoryReplSet | MongoMemoryServer | any;
  let clientOptions: MongoClientOptions;

  if (topology === "replset") {
    if (mongoUrl) {
      console.debug("Using external MongoDB URL from MONGODB_URL environment variable");
      uri = mongoUrl;
      clientOptions = getReplicaClientOptions();
      return MongoClient.connect(uri, clientOptions);
    }

    console.debug("Starting MongoDB replica set using GenericContainer...");
    const container = await new GenericContainer("mongo:7.0.14")
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

    clientOptions = getReplicaClientOptions();

    setGlobalCleanups(() => container.stop());

    return MongoClient.connect(uri, clientOptions);
  } else {
    mongod = await MongoMemoryServer.create(getStandaloneServerOptions());
    clientOptions = {};
  }

  setGlobalCleanups(() => mongod.stop());

  uri = mongod.getUri() + "&retryWrites=false";

  return MongoClient.connect(uri, clientOptions);
}

function setGlobalCleanups(stopCallback) {
  globalThis.__CLEANUPCALLBACKS = globalThis.__CLEANUPCALLBACKS || [];
  globalThis.__CLEANUPCALLBACKS.push(() => setTimeout(() => stopCallback(), 2000));
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

function getServerOptions() {
  return {
    binary: {version: MONGODB_BINARY_VERSION}
  };
}

function getStandaloneServerOptions(): any {
  return getServerOptions();
}

function getReplicaServerOptions(): any {
  return {
    ...getServerOptions(),
    replSet: {count: 1, storageEngine: "wiredTiger"}
  };
}

function generateUniqueDatabaseName(): string {
  const base = "test";
  const uniqueSuffix = randomBytes(4).toString("hex");
  return `${base}_${uniqueSuffix}`;
}