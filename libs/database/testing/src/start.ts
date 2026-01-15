import {MongoClient, MongoClientOptions} from "mongodb";
import {MongoMemoryReplSet, MongoMemoryServer} from "mongodb-memory-server";

let uri;
let activeChangeStreams: Set<any> = new Set();

const MONGODB_BINARY_VERSION = "7.0.14";

export async function start(topology: "standalone" | "replset") {
  let mongod: MongoMemoryReplSet | MongoMemoryServer;
  let clientOptions: MongoClientOptions;

  if (topology == "replset") {
    const serverOptions = getReplicaServerOptions();
    mongod = await MongoMemoryReplSet.create(serverOptions);
    clientOptions = getReplicaClientOptions();
  } else {
    const serverOptions = getStandaloneServerOptions();
    mongod = await MongoMemoryServer.create(serverOptions);
    clientOptions = {};
  }

  globalThis.__CLEANUPCALLBACKS = globalThis.__CLEANUPCALLBACKS || [];
  globalThis.__CLEANUPCALLBACKS.push(async () => {
    // Close all active change streams before stopping MongoDB
    await closeAllChangeStreams();
    await mongod.stop();
  });

  uri = mongod.getUri() + "&retryWrites=false";

  const client = await MongoClient.connect(uri, clientOptions);

  // Track change streams to close them properly on cleanup
  trackChangeStreams(client);

  return client;
}

export async function connect(connectionUri: string) {
  const client = await MongoClient.connect(connectionUri);
  trackChangeStreams(client);
  return client;
}

export function getConnectionUri() {
  return uri;
}

export function getDatabaseName() {
  return "test";
}

export function registerChangeStream(stream: any) {
  activeChangeStreams.add(stream);

  // Suppress shutdown-related errors to prevent test flakiness
  stream.on("error", (err: any) => {
    if (
      err.codeName === "InterruptedAtShutdown" ||
      err.message?.includes("ChangeStream is closed") ||
      err.message?.includes("Client must be connected")
    ) {
      // Ignore these errors during cleanup
      return;
    }
    console.error("ChangeStream error:", err);
  });

  // Auto-remove from tracking when stream closes
  const cleanup = () => activeChangeStreams.delete(stream);
  stream.on("close", cleanup);
  stream.on("end", cleanup);
}

export async function closeAllChangeStreams() {
  const streams = Array.from(activeChangeStreams);
  activeChangeStreams.clear();

  await Promise.all(
    streams.map(async stream => {
      try {
        if (!stream.closed) {
          await stream.close();
        }
      } catch (err) {
        // Ignore errors during cleanup
      }
    })
  );
}

function trackChangeStreams(client: MongoClient) {
  // Override client.watch if it exists
  const originalClientWatch = client.watch;
  if (originalClientWatch) {
    client.watch = function (this: any, ...args: any[]) {
      const stream = originalClientWatch.apply(this, args);
      registerChangeStream(stream);
      return stream;
    };
  }
}

function getReplicaClientOptions(): MongoClientOptions {
  return {
    replicaSet: "testset",
    maxPoolSize: Number.MAX_SAFE_INTEGER
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
